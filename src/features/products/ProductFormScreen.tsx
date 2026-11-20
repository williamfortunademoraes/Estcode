import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { Alert, StyleSheet } from 'react-native';
import { Button, HelperText, Menu, Surface, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/src/components/AppScreen';
import { canManageCatalog } from '@/src/features/auth/permissions';
import { useAuthStore } from '@/src/store/auth-store';
import type { Category, Supplier } from '@/src/types/domain';
import {
  createProduct,
  deactivateProduct,
  getProduct,
  listCategories,
  listSuppliers,
  updateProduct,
} from './product-service';
import { getProductErrorMessage } from './product-error';
import { productSchema, type ProductInput } from './product-schema';

interface ProductFormScreenProps {
  productId?: string;
  initialBarcode?: string | null;
}

const emptyProduct = (initialBarcode: string | null): ProductInput => ({
  name: '', sku: null, barcode: initialBarcode, description: null, category_id: null, supplier_id: null,
  unit: 'un', minimum_stock: 0, target_stock: 0, cost_price: null, sale_price: null, active: true,
});

export function ProductFormScreen({ productId, initialBarcode = null }: ProductFormScreenProps) {
  const router = useRouter();
  const role = useAuthStore((state) => state.profile?.role ?? null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(Boolean(productId));
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [supplierMenuOpen, setSupplierMenuOpen] = useState(false);
  const { control, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<ProductInput>({
    resolver: zodResolver(productSchema) as unknown as Resolver<ProductInput>,
    defaultValues: emptyProduct(initialBarcode),
  });

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      listCategories(),
      listSuppliers(),
      productId ? getProduct(productId) : Promise.resolve(null),
    ])
      .then(([categoryResult, supplierResult, product]) => {
        if (!mounted) return;
        setCategories(categoryResult);
        setSuppliers(supplierResult);
        setSelectedCategoryId(product?.category_id ?? null);
        setSelectedSupplierId(product?.supplier_id ?? null);
        if (product) reset({ ...product, description: product.description, sku: product.sku, barcode: product.barcode, category_id: product.category_id, supplier_id: product.supplier_id, cost_price: product.cost_price, sale_price: product.sale_price });
        setLoadError(null);
      })
      .catch(() => { if (mounted) setLoadError('Não foi possível carregar os dados do formulário.'); })
      .finally(() => { if (mounted) setIsLoadingData(false); });
    return () => { mounted = false; };
  }, [productId, reset]);

  const selectedCategory = useMemo(() => categories.find((item) => item.id === selectedCategoryId), [categories, selectedCategoryId]);
  const selectedSupplier = useMemo(() => suppliers.find((item) => item.id === selectedSupplierId), [selectedSupplierId, suppliers]);

  if (!canManageCatalog(role)) {
    return <AppScreen><Surface style={styles.card} elevation={0}><Text variant="titleMedium">Acesso restrito</Text><Text style={styles.muted}>Somente administradores podem cadastrar ou editar produtos.</Text></Surface></AppScreen>;
  }

  const onSubmit = async (values: ProductInput) => {
    setSubmitError(null);
    try {
      if (productId) await updateProduct(productId, values);
      else await createProduct(values);
      router.back();
    } catch (error) {
      setSubmitError(getProductErrorMessage(error));
    }
  };

  const confirmDeactivate = () => {
    if (!productId) return;
    Alert.alert('Desativar produto', 'O produto ficará fora do catálogo, mas seu histórico será preservado.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desativar', style: 'destructive', onPress: () => { void deactivateProduct(productId).then(() => router.back()).catch((error) => setSubmitError(getProductErrorMessage(error))); } },
    ]);
  };

  if (isLoadingData) return <AppScreen><Text style={styles.muted}>Carregando formulário…</Text></AppScreen>;
  if (loadError) return <AppScreen><HelperText type="error" visible>{loadError}</HelperText></AppScreen>;

  return (
    <AppScreen>
      <Text variant="headlineSmall" style={styles.title}>{productId ? 'Editar produto' : 'Novo produto'}</Text>
      <Text style={styles.muted}>Campos com informação consistente evitam duplicidade e melhoram a reposição.</Text>
      {submitError ? <HelperText type="error" visible>{submitError}</HelperText> : null}
      <Surface style={styles.card} elevation={1}>
        <Controller control={control} name="name" render={({ field: { onChange, onBlur, value } }) => <TextInput label="Nome *" value={value} onBlur={onBlur} onChangeText={onChange} error={Boolean(errors.name)} />} />
        <HelperText type="error" visible={Boolean(errors.name)}>{errors.name?.message}</HelperText>
        <Controller control={control} name="sku" render={({ field: { onChange, onBlur, value } }) => <TextInput label="SKU / código interno" value={value ?? ''} onBlur={onBlur} onChangeText={onChange} error={Boolean(errors.sku)} />} />
        <HelperText type="error" visible={Boolean(errors.sku)}>{errors.sku?.message}</HelperText>
        <Controller control={control} name="barcode" render={({ field: { onChange, onBlur, value } }) => <TextInput label="EAN / GTIN" value={value ?? ''} onBlur={onBlur} onChangeText={onChange} keyboardType="number-pad" error={Boolean(errors.barcode)} />} />
        <HelperText type="error" visible={Boolean(errors.barcode)}>{errors.barcode?.message}</HelperText>
        <Controller control={control} name="unit" render={({ field: { onChange, onBlur, value } }) => <TextInput label="Unidade *" value={value} onBlur={onBlur} onChangeText={onChange} error={Boolean(errors.unit)} />} />
        <Controller control={control} name="description" render={({ field: { onChange, onBlur, value } }) => <TextInput label="Descrição" value={value ?? ''} onBlur={onBlur} onChangeText={onChange} multiline />} />
        <Controller control={control} name="minimum_stock" render={({ field: { onChange, value } }) => <TextInput label="Estoque mínimo *" value={String(value)} onChangeText={(text) => onChange(Number(text.replace(',', '.')) || 0)} keyboardType="decimal-pad" error={Boolean(errors.minimum_stock)} />} />
        <Controller control={control} name="target_stock" render={({ field: { onChange, value } }) => <TextInput label="Estoque-alvo *" value={String(value)} onChangeText={(text) => onChange(Number(text.replace(',', '.')) || 0)} keyboardType="decimal-pad" error={Boolean(errors.target_stock)} />} />
        <HelperText type="error" visible={Boolean(errors.target_stock)}>{errors.target_stock?.message}</HelperText>
        <Controller control={control} name="cost_price" render={({ field: { onChange, value } }) => <TextInput label="Custo unitário" value={value == null ? '' : String(value)} onChangeText={(text) => onChange(text.trim() === '' ? null : Number(text.replace(',', '.')))} keyboardType="decimal-pad" />} />
        <Controller control={control} name="sale_price" render={({ field: { onChange, value } }) => <TextInput label="Preço de venda" value={value == null ? '' : String(value)} onChangeText={(text) => onChange(text.trim() === '' ? null : Number(text.replace(',', '.')))} keyboardType="decimal-pad" />} />
        <Menu visible={categoryMenuOpen} onDismiss={() => setCategoryMenuOpen(false)} anchor={<Button mode="outlined" onPress={() => setCategoryMenuOpen(true)}>{selectedCategory?.name ?? 'Selecionar categoria'}</Button>}>
          <Menu.Item onPress={() => { setValue('category_id', null); setSelectedCategoryId(null); setCategoryMenuOpen(false); }} title="Sem categoria" />
          {categories.map((category) => <Menu.Item key={category.id} onPress={() => { setValue('category_id', category.id); setSelectedCategoryId(category.id); setCategoryMenuOpen(false); }} title={category.name} />)}
        </Menu>
        <Menu visible={supplierMenuOpen} onDismiss={() => setSupplierMenuOpen(false)} anchor={<Button mode="outlined" onPress={() => setSupplierMenuOpen(true)}>{selectedSupplier?.name ?? 'Selecionar fornecedor'}</Button>}>
          <Menu.Item onPress={() => { setValue('supplier_id', null); setSelectedSupplierId(null); setSupplierMenuOpen(false); }} title="Sem fornecedor" />
          {suppliers.map((supplier) => <Menu.Item key={supplier.id} onPress={() => { setValue('supplier_id', supplier.id); setSelectedSupplierId(supplier.id); setSupplierMenuOpen(false); }} title={supplier.name} />)}
        </Menu>
        <Button mode="contained" onPress={() => { void handleSubmit(onSubmit)(); }} loading={isSubmitting} disabled={isSubmitting} contentStyle={styles.buttonContent}>{productId ? 'Salvar alterações' : 'Cadastrar produto'}</Button>
        {productId ? <Button mode="text" textColor="#D92D20" onPress={confirmDeactivate}>Desativar produto</Button> : null}
      </Surface>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 16, fontWeight: '700' },
  muted: { marginTop: 8, marginBottom: 18, color: '#667085', lineHeight: 21 },
  card: { gap: 8, padding: 18, borderRadius: 18, backgroundColor: '#FFFFFF' },
  buttonContent: { minHeight: 48 },
});
