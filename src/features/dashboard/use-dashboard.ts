import { useCallback, useEffect, useState } from 'react';

import { getDashboardMetrics, getInventoryInsights, getReplenishmentSuggestions, getSharedInventoryId, listStockHistory, type StockMovementWithContext } from '@/src/features/inventory/inventory-service';
import { useStockRealtime } from '@/src/features/inventory/use-stock-realtime';
import type { DashboardMetrics, InventoryInsights, ReplenishmentSuggestion } from '@/src/types/domain';

export function useDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [suggestions, setSuggestions] = useState<ReplenishmentSuggestion[]>([]);
  const [insights, setInsights] = useState<InventoryInsights | null>(null);
  const [recentMovements, setRecentMovements] = useState<StockMovementWithContext[]>([]);
  const [inventoryId, setInventoryId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const sharedId = await getSharedInventoryId();
      const [dashboard, replenishment, inventoryInsights, history] = await Promise.all([
        getDashboardMetrics(sharedId),
        getReplenishmentSuggestions(sharedId),
        getInventoryInsights(sharedId),
        listStockHistory({ inventoryId: sharedId }),
      ]);
      setInventoryId(sharedId);
      setMetrics(dashboard);
      setSuggestions(replenishment);
      setInsights(inventoryInsights);
      setRecentMovements(history.slice(0, 5));
      setError(null);
    } catch {
      setError('Não foi possível carregar os indicadores do estoque.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // The async loader updates state after the remote request resolves.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  useStockRealtime(inventoryId, 'dashboard', load);
  return { inventoryId, metrics, suggestions, insights, recentMovements, isLoading, error, reload: load };
}
