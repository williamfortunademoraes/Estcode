import { calculateSuggestedQuantity, classifyStockLevel, resolveEffectiveMinimumStock } from '@/src/features/consultancy/replenishment-rules';

describe('replenishment rules', () => {
  it('flags products at or below the configured minimum', () => {
    expect(classifyStockLevel(10, 10)).toBe('replenishment_required');
    expect(classifyStockLevel(9, 10)).toBe('replenishment_required');
    expect(classifyStockLevel(11, 10)).toBe('ok');
  });

  it('never suggests a negative quantity and uses the configured target', () => {
    expect(calculateSuggestedQuantity(30, 8)).toBe(22);
    expect(calculateSuggestedQuantity(10, 12)).toBe(0);
  });

  it('uses the global minimum only when a product has no individual minimum', () => {
    expect(resolveEffectiveMinimumStock(0, 5)).toBe(5);
    expect(resolveEffectiveMinimumStock(3, 5)).toBe(3);
    expect(resolveEffectiveMinimumStock(0, 0)).toBe(0);
  });
});
