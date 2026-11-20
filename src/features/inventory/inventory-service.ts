import { supabase } from '@/src/lib/supabase';
import type {
  DashboardMetrics,
  InventoryInsights,
  InventorySettings,
  ReplenishmentSuggestion,
  StockBalance,
  StockMovement,
  StockMovementResult,
} from '@/src/types/domain';
import { adjustmentSchema, entrySchema, exitSchema, type AdjustmentInput, type EntryInput, type ExitInput } from './inventory-schema';

export interface StockHistoryFilters {
  inventoryId: string;
  productId?: string;
  movementType?: StockMovement['movement_type'];
  userId?: string;
  from?: string;
  to?: string;
}

export interface StockMovementWithContext extends StockMovement {
  product_name: string;
  user_name: string;
}

function requireSupabase() {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
  return supabase;
}

export function createIdempotencyKey(): string {
  const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return template.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function isRetryableInventoryError(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
      ? error.message
      : '';
  return /network request failed|failed to fetch|fetch failed|network error|timed out|timeout|econn|offline/i.test(message);
}

export async function getSharedInventoryId(): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_shared_inventory_id');
  if (error) throw error;
  if (!data) throw new Error('SHARED_INVENTORY_NOT_FOUND');
  return data;
}

export async function registerEntry(input: EntryInput): Promise<StockMovementResult> {
  const client = requireSupabase();
  const parsed = entrySchema.parse({ ...input, idempotency_key: input.idempotency_key ?? createIdempotencyKey() });
  const { data, error } = await client.rpc('register_stock_entry', {
    p_inventory_id: parsed.inventory_id,
    p_product_id: parsed.product_id,
    p_quantity: parsed.quantity,
    p_reason: parsed.reason,
    p_notes: parsed.notes ?? null,
    p_idempotency_key: parsed.idempotency_key,
  });
  if (error) throw error;
  return data as StockMovementResult;
}

export async function registerExit(input: ExitInput): Promise<StockMovementResult> {
  const client = requireSupabase();
  const parsed = exitSchema.parse({ ...input, idempotency_key: input.idempotency_key ?? createIdempotencyKey() });
  const { data, error } = await client.rpc('register_stock_exit', {
    p_inventory_id: parsed.inventory_id,
    p_product_id: parsed.product_id,
    p_quantity: parsed.quantity,
    p_reason: parsed.reason,
    p_notes: parsed.notes ?? null,
    p_idempotency_key: parsed.idempotency_key,
  });
  if (error) throw error;
  return data as StockMovementResult;
}

export async function registerAdjustment(input: AdjustmentInput): Promise<StockMovementResult> {
  const client = requireSupabase();
  const parsed = adjustmentSchema.parse({ ...input, idempotency_key: input.idempotency_key ?? createIdempotencyKey() });
  const { data, error } = await client.rpc('register_stock_adjustment', {
    p_inventory_id: parsed.inventory_id,
    p_product_id: parsed.product_id,
    p_counted_quantity: parsed.counted_quantity,
    p_reason: parsed.reason,
    p_notes: parsed.notes ?? null,
    p_idempotency_key: parsed.idempotency_key,
  });
  if (error) throw error;
  return data as StockMovementResult;
}

export async function listBalances(inventoryId: string): Promise<StockBalance[]> {
  const client = requireSupabase();
  const { data, error } = await client.from('stock_balances').select('*').eq('inventory_id', inventoryId);
  if (error) throw error;
  return (data ?? []) as StockBalance[];
}

export async function getInventorySettings(inventoryId: string): Promise<InventorySettings> {
  const client = requireSupabase();
  const { data, error } = await client.from('inventory_settings').select('*').eq('inventory_id', inventoryId).single();
  if (error) throw error;
  return data as InventorySettings;
}

export async function updateInventorySettings(
  inventoryId: string,
  changes: Pick<InventorySettings, 'allow_negative_balance' | 'allow_operator_adjustments'>,
): Promise<InventorySettings> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('inventory_settings')
    .update(changes)
    .eq('inventory_id', inventoryId)
    .select('*')
    .single();
  if (error) throw error;
  return data as InventorySettings;
}

export async function listStockHistory(filters: StockHistoryFilters): Promise<StockMovementWithContext[]> {
  const client = requireSupabase();
  let query = client.from('stock_movements').select('*').eq('inventory_id', filters.inventoryId).order('created_at', { ascending: false });
  if (filters.productId) query = query.eq('product_id', filters.productId);
  if (filters.movementType) query = query.eq('movement_type', filters.movementType);
  if (filters.userId) query = query.eq('user_id', filters.userId);
  if (filters.from) query = query.gte('created_at', filters.from);
  if (filters.to) query = query.lte('created_at', filters.to);
  const { data, error } = await query;
  if (error) throw error;
  const movements = (data ?? []) as StockMovement[];
  const productIds = [...new Set(movements.map((item) => item.product_id))];
  const userIds = [...new Set(movements.map((item) => item.user_id))];
  const [productsResult, profilesResult] = await Promise.all([
    productIds.length ? client.from('products').select('id, name').in('id', productIds) : Promise.resolve({ data: [], error: null }),
    userIds.length ? client.from('profiles').select('id, full_name').in('id', userIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (productsResult.error) throw productsResult.error;
  if (profilesResult.error) throw profilesResult.error;
  const products = new Map((productsResult.data ?? []).map((item) => [item.id, item.name]));
  const profiles = new Map((profilesResult.data ?? []).map((item) => [item.id, item.full_name]));
  return movements.map((movement) => ({
    ...movement,
    product_name: products.get(movement.product_id) ?? 'Produto não encontrado',
    user_name: profiles.get(movement.user_id) ?? 'Usuário não encontrado',
  }));
}

export async function getDashboardMetrics(inventoryId: string): Promise<DashboardMetrics> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_inventory_dashboard', { p_inventory_id: inventoryId });
  if (error) throw error;
  return data as DashboardMetrics;
}

export async function getReplenishmentSuggestions(inventoryId: string): Promise<ReplenishmentSuggestion[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_replenishment_suggestions', { p_inventory_id: inventoryId });
  if (error) throw error;
  return (data ?? []) as ReplenishmentSuggestion[];
}

export async function getInventoryInsights(inventoryId: string): Promise<InventoryInsights> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_inventory_insights', { p_inventory_id: inventoryId });
  if (error) throw error;
  return data as InventoryInsights;
}

export function getInventoryErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === 'SUPABASE_NOT_CONFIGURED') return 'Configure o Supabase para operar o estoque.';
    if (error.message.includes('insufficient_stock')) return 'Saldo insuficiente para esta saída.';
    if (error.message.includes('adjustment_not_allowed')) return 'Seu perfil não está autorizado a fazer ajustes.';
    if (error.message.includes('idempotency_key_conflict')) return 'Esta operação já foi usada por outra tentativa.';
    if (error.message.includes('reason_required')) return 'Informe o motivo da movimentação.';
  }
  return 'Não foi possível confirmar a movimentação no servidor.';
}
