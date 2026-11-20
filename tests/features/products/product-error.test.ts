import { getProductErrorMessage } from '@/src/features/products/product-error';

describe('product error messages', () => {
  it('maps duplicate database constraints without exposing SQL details', () => {
    expect(getProductErrorMessage(new Error('23505 duplicate key'))).toContain('SKU ou código de barras');
  });

  it('handles missing public configuration', () => {
    expect(getProductErrorMessage(new Error('SUPABASE_NOT_CONFIGURED'))).toContain('Configure o Supabase');
  });

  it('uses a safe generic message for unknown failures', () => {
    expect(getProductErrorMessage(new Error('internal'))).toContain('Não foi possível salvar');
  });

  it('maps a duplicate identifier without a PostgreSQL code', () => {
    expect(getProductErrorMessage(new Error('duplicate identifier'))).toContain('identificador');
  });

  it('does not expose arbitrary non-error values', () => {
    expect(getProductErrorMessage({ message: 'duplicate identifier' })).toContain('Não foi possível salvar');
  });
});
