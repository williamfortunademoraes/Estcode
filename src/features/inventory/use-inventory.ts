import { useCallback, useEffect, useState } from 'react';

import { listProducts } from '@/src/features/products/product-service';
import type { InventorySettings, Product, StockBalance } from '@/src/types/domain';
import { getInventorySettings, getSharedInventoryId, listBalances, listStockHistory, type StockHistoryFilters, type StockMovementWithContext } from './inventory-service';
import { useStockRealtime } from './use-stock-realtime';

export function useInventory() {
  const [inventoryId, setInventoryId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [settings, setSettings] = useState<InventorySettings | null>(null);
  const [history, setHistory] = useState<StockMovementWithContext[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const sharedId = await getSharedInventoryId();
      const [productResult, balanceResult, settingsResult] = await Promise.all([
        listProducts(),
        listBalances(sharedId),
        getInventorySettings(sharedId),
      ]);
      setInventoryId(sharedId);
      setProducts(productResult);
      setBalances(balanceResult);
      setSettings(settingsResult);
      setError(null);
    } catch {
      setError('Não foi possível carregar o estoque compartilhado.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async (filters: Omit<StockHistoryFilters, 'inventoryId'> = {}) => {
    if (!inventoryId) return;
    setIsHistoryLoading(true);
    try {
      setHistory(await listStockHistory({ inventoryId, ...filters }));
    } catch {
      setError('Não foi possível carregar o histórico.');
    } finally {
      setIsHistoryLoading(false);
    }
  }, [inventoryId]);

  // The async loaders update state after the remote request resolves.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const refresh = useCallback(async () => {
    await load();
    await loadHistory();
  }, [load, loadHistory]);

  const handleRealtimeChange = useCallback(() => {
    void load();
    void loadHistory();
  }, [load, loadHistory]);
  useStockRealtime(inventoryId, 'inventory', handleRealtimeChange);

  return { inventoryId, products, balances, settings, history, isLoading, isHistoryLoading, error, refresh, loadHistory };
}
