import { formatProductPrice, getProductPricePresentation } from '@/src/features/products/product-presentation';

describe('product presentation', () => {
  it('formats a known price in Brazilian currency', () => {
    expect(formatProductPrice(12.5)).toBe('R$ 12,50');
  });

  it('labels a missing price without inventing a value', () => {
    expect(formatProductPrice(null)).toBe('Não informado');
  });

  it('shows sale price to all roles and limits cost to administrators', () => {
    expect(getProductPricePresentation({ sale_price: 15, cost_price: 8 }, 'consultant')).toEqual({
      sale: 'R$ 15,00',
      cost: null,
    });
    expect(getProductPricePresentation({ sale_price: 15, cost_price: 8 }, 'admin')).toEqual({
      sale: 'R$ 15,00',
      cost: 'R$ 8,00',
    });
  });
});
