import type { UserRole } from '@/src/types/domain';

const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatProductPrice(price: number | null): string {
  return price === null ? 'Não informado' : brlFormatter.format(price);
}

export function getProductPricePresentation(
  product: { sale_price: number | null; cost_price: number | null },
  role: UserRole | null,
): { sale: string; cost: string | null } {
  return {
    sale: formatProductPrice(product.sale_price),
    cost: role === 'admin' ? formatProductPrice(product.cost_price) : null,
  };
}
