export type SupportedBarcodeType = 'ean8' | 'ean13';

export function isValidGtin(value: string): boolean {
  if (![8, 12, 13, 14].includes(value.length) || !/^\d+$/.test(value)) return false;
  const digits = value.split('').map(Number);
  const checkDigit = Number(value.at(-1));

  const sum = digits.slice(0, -1).reduce((total, digit, index) => {
    const distanceFromRight = digits.length - 1 - index;
    return total + digit * (distanceFromRight % 2 === 0 ? 1 : 3);
  }, 0);

  return (10 - (sum % 10)) % 10 === checkDigit;
}

export function isSupportedBarcode(type: string, data: string): type is SupportedBarcodeType {
  const normalized = data.trim();
  const expectedLength = type === 'ean8' ? 8 : type === 'ean13' ? 13 : 0;
  return expectedLength > 0
    && normalized.length === expectedLength
    && /^\d+$/.test(normalized)
    && isValidGtin(normalized);
}

export function shouldProcessBarcode(
  previousValue: string | null,
  previousTimestamp: number | null,
  nextValue: string,
  now: number,
  cooldownMs: number,
): boolean {
  if (!previousValue || previousTimestamp === null) return true;
  if (previousValue !== nextValue) return true;
  return now - previousTimestamp >= cooldownMs;
}
