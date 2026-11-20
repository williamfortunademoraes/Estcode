import { adjustmentSchema, entrySchema, exitSchema } from '@/src/features/inventory/inventory-schema';

const base = { inventory_id: '11111111-1111-4111-8111-111111111111', product_id: '22222222-2222-4222-8222-222222222222', reason: 'Conferência' };

describe('inventory operation schemas', () => {
  it('validates positive entries and exits', () => {
    expect(entrySchema.parse({ ...base, quantity: 2 }).quantity).toBe(2);
    expect(exitSchema.parse({ ...base, quantity: 1 }).quantity).toBe(1);
    expect(() => entrySchema.parse({ ...base, quantity: 0 })).toThrow();
  });

  it('requires a non-negative counted quantity for adjustments', () => {
    expect(adjustmentSchema.parse({ ...base, counted_quantity: 0 }).counted_quantity).toBe(0);
    expect(() => adjustmentSchema.parse({ ...base, counted_quantity: -1 })).toThrow();
  });
});
