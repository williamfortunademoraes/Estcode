export function isValidCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 14 || /^([0-9])\1{13}$/.test(digits)) return false;
  const digit = (base: string, weights: number[]) => String((11 - [...base].reduce((sum, number, index) => sum + Number(number) * weights[index]!, 0) % 11) % 10);
  return digit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === digits[12]
    && digit(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === digits[13];
}
