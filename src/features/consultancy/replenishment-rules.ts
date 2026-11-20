export type StockLevelClassification = 'replenishment_required' | 'ok';

export function resolveEffectiveMinimumStock(productMinimumStock: number, globalMinimumStock: number): number {
  return productMinimumStock > 0 ? productMinimumStock : globalMinimumStock;
}

export function classifyStockLevel(currentQuantity: number, minimumStock: number): StockLevelClassification {
  return currentQuantity <= minimumStock ? 'replenishment_required' : 'ok';
}

export function calculateSuggestedQuantity(targetStock: number, currentQuantity: number): number {
  return Math.max(0, targetStock - currentQuantity);
}
