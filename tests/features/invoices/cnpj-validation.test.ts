import { isValidCnpj } from '@/src/features/invoices/cnpj';

describe('CNPJ validation', () => {
  it('validates both check digits', () => {
    expect(isValidCnpj('11222333000181')).toBe(true);
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11222333000182')).toBe(false);
    expect(isValidCnpj('00000000000000')).toBe(false);
  });
});
