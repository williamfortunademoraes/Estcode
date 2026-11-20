import { productSchema } from '@/src/features/products/product-schema';

const validProduct = {
  name: 'Café em pó',
  sku: 'CAF-001',
  barcode: '7891234567895',
  description: '',
  category_id: null,
  supplier_id: null,
  unit: 'un',
  minimum_stock: 10,
  target_stock: 30,
  cost_price: 8.5,
  sale_price: 12.9,
  active: true,
};

describe('product schema', () => {
  it('normalizes optional blank fields to null', () => {
    expect(productSchema.parse({ ...validProduct, sku: '', barcode: '', description: '' })).toMatchObject({
      sku: null,
      barcode: null,
      description: null,
    });
  });

  it('requires a target stock at least as high as the minimum', () => {
    expect(() => productSchema.parse({ ...validProduct, target_stock: 5 })).toThrow();
  });

  it('accepts EAN-8 and rejects malformed barcodes', () => {
    expect(productSchema.parse({ ...validProduct, barcode: '96385074' }).barcode).toBe('96385074');
    expect(() => productSchema.parse({ ...validProduct, barcode: '1234' })).toThrow();
  });

  it('rejects a GTIN with an invalid check digit', () => {
    expect(() => productSchema.parse({ ...validProduct, barcode: '7891234567894' })).toThrow();
  });

  it('normalizes blank relationship identifiers', () => {
    expect(productSchema.parse({ ...validProduct, category_id: '', supplier_id: ' ' })).toMatchObject({
      category_id: null,
      supplier_id: null,
    });
  });
});
