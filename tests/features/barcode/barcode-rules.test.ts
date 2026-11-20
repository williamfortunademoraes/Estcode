import { isSupportedBarcode, shouldProcessBarcode } from '@/src/features/barcode/barcode-rules';

describe('barcode rules', () => {
  it('accepts EAN-8 and EAN-13 scanner events only', () => {
    expect(isSupportedBarcode('ean8', '96385074')).toBe(true);
    expect(isSupportedBarcode('ean13', '7891234567895')).toBe(true);
    expect(isSupportedBarcode('qr', 'anything')).toBe(false);
  });

  it('rejects malformed EAN payloads', () => {
    expect(isSupportedBarcode('ean8', '123')).toBe(false);
    expect(isSupportedBarcode('ean13', '789123456789')).toBe(false);
    expect(isSupportedBarcode('ean13', '789123456789A')).toBe(false);
    expect(isSupportedBarcode('ean8', ' 96385074 ')).toBe(true);
  });

  it('rejects EAN values with an invalid check digit', () => {
    expect(isSupportedBarcode('ean8', '96385075')).toBe(false);
    expect(isSupportedBarcode('ean13', '7891234567894')).toBe(false);
  });

  it('debounces repeated reads during the cooldown window', () => {
    expect(shouldProcessBarcode(null, null, '789', 0, 1200)).toBe(true);
    expect(shouldProcessBarcode('789', 1000, '789', 1500, 1200)).toBe(false);
    expect(shouldProcessBarcode('789', 1000, '789', 2300, 1200)).toBe(true);
    expect(shouldProcessBarcode('789', 1000, '788', 1100, 1200)).toBe(true);
  });
});
