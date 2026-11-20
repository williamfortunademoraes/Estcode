const MAX_PRODUCT_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_PRODUCT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function getProductImageValidationError(mimeType: string | null, byteLength: number): string | null {
  if (!mimeType || !ALLOWED_PRODUCT_IMAGE_TYPES.has(mimeType.toLowerCase())) return 'PRODUCT_IMAGE_TYPE_NOT_ALLOWED';
  if (!Number.isFinite(byteLength) || byteLength < 0 || byteLength > MAX_PRODUCT_IMAGE_BYTES) return 'PRODUCT_IMAGE_TOO_LARGE';
  return null;
}
