import { File } from 'expo-file-system';

import { supabase } from '@/src/lib/supabase';
import type { Category, Product, Supplier } from '@/src/types/domain';
import { productSchema, type ProductInput } from './product-schema';
import { getProductImageValidationError } from './product-image-rules';

function requireSupabase() {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
  return supabase;
}

function toProduct(data: unknown): Product {
  return data as Product;
}

async function addSignedImageUrls(products: Product[]): Promise<Product[]> {
  const paths = [...new Set(products.flatMap((product) => product.image_path ? [product.image_path] : []))];
  if (!paths.length) return products.map((product) => ({ ...product, image_url: null }));
  try {
    const { data, error } = await requireSupabase().storage.from('product-images').createSignedUrls(paths, 3600);
    if (error) return products.map((product) => ({ ...product, image_url: null }));
    const urls = new Map((data ?? []).map((item) => [item.path, item.signedUrl]));
    return products.map((product) => ({ ...product, image_url: product.image_path ? urls.get(product.image_path) ?? null : null }));
  } catch {
    return products.map((product) => ({ ...product, image_url: null }));
  }
}

export interface ProductFilters {
  search?: string;
  categoryId?: string;
}

export async function listProducts(filters: ProductFilters = {}): Promise<Product[]> {
  const client = requireSupabase();
  const search = filters.search?.trim() ?? '';
  const fetchBy = async (field?: 'name' | 'sku') => {
    let query = client.from('products').select('*').eq('active', true).order('name');
    if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
    if (field && search) query = query.ilike(field, `%${search}%`);
    const { data, error } = await query;
    if (error) throw error;
    return addSignedImageUrls((data ?? []).map(toProduct));
  };

  if (!search) return fetchBy();
  const [nameMatches, skuMatches, barcodeResult] = await Promise.all([
    fetchBy('name'),
    fetchBy('sku'),
    client
      .from('products')
      .select('*')
      .eq('active', true)
      .eq('barcode', search)
      .maybeSingle(),
  ]);
  if (barcodeResult.error) throw barcodeResult.error;
  const byId = new Map<string, Product>();
  for (const product of [...nameMatches, ...skuMatches, ...(barcodeResult.data ? [toProduct(barcodeResult.data)] : [])]) {
    byId.set(product.id, product);
  }
  return addSignedImageUrls([...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
}

export async function getProduct(productId: string): Promise<Product> {
  const client = requireSupabase();
  const { data, error } = await client.from('products').select('*').eq('id', productId).single();
  if (error) throw error;
  const [product] = await addSignedImageUrls([toProduct(data)]);
  return product ?? toProduct(data);
}

export async function saveProductImage(productId: string, uri: string, mimeType: string | null): Promise<string> {
  const client = requireSupabase();
  const contentType = mimeType?.toLowerCase() ?? null;
  const file = new File(uri);
  const fileBytes = await file.arrayBuffer();
  const validationError = getProductImageValidationError(contentType, fileBytes.byteLength);
  if (validationError) throw new Error(validationError);
  if (!contentType) throw new Error('PRODUCT_IMAGE_TYPE_NOT_ALLOWED');
  const path = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const { error: uploadError } = await client.storage.from('product-images').upload(path, fileBytes, {
    contentType,
    upsert: false,
    cacheControl: '3600',
  });
  if (uploadError) throw uploadError;
  const { data: current } = await client.from('products').select('image_path').eq('id', productId).maybeSingle();
  const { error: updateError } = await client.from('products').update({ image_path: path }).eq('id', productId);
  if (updateError) {
    await client.storage.from('product-images').remove([path]);
    throw updateError;
  }
  if (current?.image_path && current.image_path !== path) {
    await client.storage.from('product-images').remove([current.image_path]);
  }
  return path;
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  const client = requireSupabase();
  const normalized = barcode.trim();
  const { data, error } = await client.from('products').select('*').eq('barcode', normalized).eq('active', true).maybeSingle();
  if (error) throw error;
  return data ? toProduct(data) : null;
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const client = requireSupabase();
  const validated = productSchema.parse(input);
  const { data, error } = await client.from('products').insert(validated).select('*').single();
  if (error) throw error;
  return toProduct(data);
}

export async function updateProduct(productId: string, input: ProductInput): Promise<Product> {
  const client = requireSupabase();
  const validated = productSchema.parse(input);
  const { data, error } = await client.from('products').update(validated).eq('id', productId).select('*').single();
  if (error) throw error;
  return toProduct(data);
}

export async function deactivateProduct(productId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('products').update({ active: false }).eq('id', productId);
  if (error) throw error;
}

export async function listCategories(): Promise<Category[]> {
  const client = requireSupabase();
  const { data, error } = await client.from('categories').select('*').eq('active', true).order('name');
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function listSuppliers(): Promise<Supplier[]> {
  const client = requireSupabase();
  const { data, error } = await client.from('suppliers').select('*').eq('active', true).order('name');
  if (error) throw error;
  return (data ?? []) as Supplier[];
}

export async function createCategory(name: string, description: string | null): Promise<Category> {
  const client = requireSupabase();
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error('CATEGORY_NAME_REQUIRED');
  const { data, error } = await client.from('categories').insert({ name: normalizedName, description }).select('*').single();
  if (error) throw error;
  return data as Category;
}

export async function updateCategory(categoryId: string, changes: Pick<Category, 'name' | 'description' | 'active'>): Promise<Category> {
  const client = requireSupabase();
  const name = changes.name.trim();
  if (!name) throw new Error('CATEGORY_NAME_REQUIRED');
  const { data, error } = await client.from('categories').update({ ...changes, name }).eq('id', categoryId).select('*').single();
  if (error) throw error;
  return data as Category;
}

export async function createSupplier(input: Pick<Supplier, 'name' | 'document' | 'phone' | 'email'>): Promise<Supplier> {
  const client = requireSupabase();
  const normalizedName = input.name.trim();
  if (!normalizedName) throw new Error('SUPPLIER_NAME_REQUIRED');
  const { data, error } = await client.from('suppliers').insert({ ...input, name: normalizedName }).select('*').single();
  if (error) throw error;
  return data as Supplier;
}

export async function updateSupplier(supplierId: string, changes: Pick<Supplier, 'name' | 'document' | 'phone' | 'email' | 'active'>): Promise<Supplier> {
  const client = requireSupabase();
  const name = changes.name.trim();
  if (!name) throw new Error('SUPPLIER_NAME_REQUIRED');
  const { data, error } = await client.from('suppliers').update({ ...changes, name }).eq('id', supplierId).select('*').single();
  if (error) throw error;
  return data as Supplier;
}
