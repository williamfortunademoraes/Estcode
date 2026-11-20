export type StockLevelClassification = 'replenishment_required' | 'ok';

export function classifyStockLevel(currentQuantity: number, minimumStock: number): StockLevelClassification {
  return currentQuantity <= minimumStock ? 'replenishment_required' : 'ok';
}

export function calculateSuggestedQuantity(targetStock: number, currentQuantity: number): number {
  return Math.max(0, targetStock - currentQuantity);
}
