import { getProductImageValidationError } from '@/src/features/products/product-image-rules';

describe('product image rules', () => {
  it('accepts supported image formats under the storage limit', () => {
    expect(getProductImageValidationError('image/jpeg', 8 * 1024 * 1024)).toBeNull();
    expect(getProductImageValidationError('image/webp', 1024)).toBeNull();
  });

  it('rejects unsupported formats and oversized files', () => {
    expect(getProductImageValidationError('image/gif', 1024)).toBe('PRODUCT_IMAGE_TYPE_NOT_ALLOWED');
    expect(getProductImageValidationError('image/png', 8 * 1024 * 1024 + 1)).toBe('PRODUCT_IMAGE_TOO_LARGE');
  });
});
