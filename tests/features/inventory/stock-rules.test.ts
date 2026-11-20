import { calculateAdjustment, validateExit } from '@/src/features/inventory/stock-rules';

describe('stock rules', () => {
  it('calculates an adjustment delta and resulting balance', () => {
    expect(calculateAdjustment(12, 9)).toEqual({ delta: -3, resultingBalance: 9 });
  });

  it('blocks an exit that would make the balance negative by default', () => {
    expect(validateExit(6, 5, false)).toEqual({ allowed: false, resultingBalance: -1, reason: 'insufficient_stock' });
  });

  it('allows a negative exit only when the administrative setting is enabled', () => {
    expect(validateExit(6, 5, true)).toEqual({ allowed: true, resultingBalance: -1 });
  });
});
