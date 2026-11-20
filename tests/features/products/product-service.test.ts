import { supabase } from '@/src/lib/supabase';
import { createProduct, getProductByBarcode, listProducts } from '@/src/features/products/product-service';

jest.mock('@/src/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const client = supabase as unknown as { from: jest.Mock };
const product = {
  id: 'product-1',
  name: 'Café',
  sku: 'CAF-001',
  barcode: '7891234567895',
  description: null,
  category_id: null,
  supplier_id: null,
  unit: 'un',
  minimum_stock: 2,
  target_stock: 10,
  cost_price: null,
  sale_price: null,
  active: true,
  created_at: '',
  updated_at: '',
};

function listQuery(data: unknown) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    ilike: jest.fn(),
    maybeSingle: jest.fn(),
    then: (resolve: (value: unknown) => unknown) => resolve({ data, error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.ilike.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error: null });
  return query;
}

describe('product service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('searches by name, SKU and exact barcode without duplicating products', async () => {
    const nameQuery = listQuery([product]);
    const skuQuery = listQuery([product]);
    const barcodeQuery = listQuery(product);
    client.from.mockReturnValueOnce(nameQuery).mockReturnValueOnce(skuQuery).mockReturnValueOnce(barcodeQuery);

    await expect(listProducts({ search: 'CAF-001' })).resolves.toEqual([product]);
    expect(nameQuery.ilike).toHaveBeenCalledWith('name', '%CAF-001%');
    expect(skuQuery.ilike).toHaveBeenCalledWith('sku', '%CAF-001%');
    expect(barcodeQuery.eq).toHaveBeenCalledWith('barcode', 'CAF-001');
  });

  it('looks up an active product by barcode', async () => {
    const query = listQuery(product);
    client.from.mockReturnValue(query);

    await expect(getProductByBarcode(' 7891234567895 ')).resolves.toEqual(product);
    expect(query.eq).toHaveBeenCalledWith('barcode', '7891234567895');
    expect(query.eq).toHaveBeenCalledWith('active', true);
  });

  it('validates and persists a product through the catalog service', async () => {
    const query = { insert: jest.fn(), select: jest.fn(), single: jest.fn() };
    query.insert.mockReturnValue(query);
    query.select.mockReturnValue(query);
    query.single.mockResolvedValue({ data: product, error: null });
    client.from.mockReturnValue(query);

    await expect(createProduct({
      name: ' Café ', sku: 'CAF-001', barcode: '7891234567895', description: null,
      category_id: null, supplier_id: null, unit: 'un', minimum_stock: 2, target_stock: 10,
      cost_price: null, sale_price: null, active: true,
    })).resolves.toEqual(product);
    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Café', sku: 'CAF-001' }));
  });
});
