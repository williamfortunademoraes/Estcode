import { supabase } from '@/src/lib/supabase';
import { createIdempotencyKey, getInventoryErrorMessage, getInventorySettings, getSharedInventoryId, isRetryableInventoryError, listStockHistory, registerAdjustment, registerEntry, registerExit, updateInventorySettings } from '@/src/features/inventory/inventory-service';

jest.mock('@/src/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
}));

const client = supabase as unknown as { rpc: jest.Mock; from: jest.Mock };
const base = { inventory_id: '11111111-1111-4111-8111-111111111111', product_id: '22222222-2222-4222-8222-222222222222', reason: 'Conferência' };
const result = { movement_id: 'movement-1', inventory_id: base.inventory_id, product_id: base.product_id, movement_type: 'entry', quantity: 2, previous_balance: 0, resulting_balance: 2, counted_quantity: null, reason: base.reason, notes: null, created_at: '', was_duplicate: false };

describe('inventory service RPC boundary', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls the entry RPC with an idempotency key', async () => {
    client.rpc.mockResolvedValue({ data: result, error: null });
    await expect(registerEntry({ ...base, quantity: 2 })).resolves.toEqual(result);
    expect(client.rpc).toHaveBeenCalledWith('register_stock_entry', expect.objectContaining({ p_quantity: 2, p_idempotency_key: expect.any(String) }));
  });

  it('routes exits and adjustments to their dedicated RPCs', async () => {
    client.rpc.mockResolvedValue({ data: result, error: null });
    await registerExit({ ...base, quantity: 1 });
    await registerAdjustment({ ...base, counted_quantity: 4 });
    expect(client.rpc.mock.calls.map(([name]) => name)).toEqual(['register_stock_exit', 'register_stock_adjustment']);
  });

  it('returns the shared inventory id and maps stock errors safely', async () => {
    client.rpc.mockResolvedValueOnce({ data: base.inventory_id, error: null });
    await expect(getSharedInventoryId()).resolves.toBe(base.inventory_id);
    expect(getInventoryErrorMessage(new Error('insufficient_stock'))).toContain('Saldo insuficiente');
    expect(getInventoryErrorMessage(new Error('unexpected'))).toContain('servidor');
  });

  it('applies product, user and period filters to history queries', async () => {
    const movement = { id: 'movement-1', ...base, user_id: 'user-1', movement_type: 'entry', quantity: 2, counted_quantity: null, previous_balance: 0, resulting_balance: 2, notes: null, idempotency_key: 'key-1', created_at: '2026-01-02T10:00:00.000Z' };
    const historyQuery = { select: jest.fn(), eq: jest.fn(), order: jest.fn(), gte: jest.fn(), lte: jest.fn() };
    historyQuery.select.mockReturnValue(historyQuery);
    historyQuery.eq.mockReturnValue(historyQuery);
    historyQuery.order.mockReturnValue(historyQuery);
    historyQuery.gte.mockReturnValue(historyQuery);
    historyQuery.lte.mockResolvedValue({ data: [movement], error: null });
    const relatedQuery = (data: unknown[]) => {
      const query = { select: jest.fn(), in: jest.fn() };
      query.select.mockReturnValue(query);
      query.in.mockResolvedValue({ data, error: null });
      return query;
    };
    client.from.mockReturnValueOnce(historyQuery).mockReturnValueOnce(relatedQuery([{ id: base.product_id, name: 'Produto' }])).mockReturnValueOnce(relatedQuery([{ id: 'user-1', full_name: 'Pessoa' }]));

    await expect(listStockHistory({
      inventoryId: base.inventory_id,
      productId: base.product_id,
      movementType: 'entry',
      userId: 'user-1',
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-31T23:59:59.999Z',
    })).resolves.toMatchObject([{ product_name: 'Produto', user_name: 'Pessoa' }]);
    expect(historyQuery.eq).toHaveBeenCalledWith('product_id', base.product_id);
    expect(historyQuery.eq).toHaveBeenCalledWith('movement_type', 'entry');
    expect(historyQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(historyQuery.gte).toHaveBeenCalledWith('created_at', '2026-01-01T00:00:00.000Z');
    expect(historyQuery.lte).toHaveBeenCalledWith('created_at', '2026-01-31T23:59:59.999Z');
  });

  it('reads and updates administrative inventory settings', async () => {
    const settings = { inventory_id: base.inventory_id, allow_negative_balance: false, allow_operator_adjustments: false, created_at: '', updated_at: '' };
    const query = { select: jest.fn(), update: jest.fn(), eq: jest.fn(), single: jest.fn() };
    query.select.mockReturnValue(query);
    query.update.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.single.mockResolvedValue({ data: settings, error: null });
    client.from.mockReturnValue(query);

    await expect(getInventorySettings(base.inventory_id)).resolves.toEqual(settings);
    await expect(updateInventorySettings(base.inventory_id, { allow_negative_balance: true, allow_operator_adjustments: true })).resolves.toEqual(settings);
    expect(query.update).toHaveBeenCalledWith({ allow_negative_balance: true, allow_operator_adjustments: true });
  });

  it('classifies only transient network failures as retryable', () => {
    expect(createIdempotencyKey()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(isRetryableInventoryError(new Error('Network request failed'))).toBe(true);
    expect(isRetryableInventoryError(new Error('insufficient_stock'))).toBe(false);
  });
});
