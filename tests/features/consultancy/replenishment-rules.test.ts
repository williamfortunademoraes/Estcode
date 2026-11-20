import { calculateSuggestedQuantity, classifyStockLevel } from '@/src/features/consultancy/replenishment-rules';

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
});
