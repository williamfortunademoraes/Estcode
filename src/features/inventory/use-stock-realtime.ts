import { useEffect } from 'react';

import { supabase } from '@/src/lib/supabase';

let channelInstance = 0;

export function useStockRealtime(inventoryId: string | null, channelScope: 'dashboard' | 'inventory', onChange: () => void) {
  useEffect(() => {
    const client = supabase;
    if (!client || !inventoryId) return undefined;
    // A channel can still be in the process of being removed when React
    // immediately remounts this hook. A unique name prevents Supabase from
    // returning that already-subscribed channel to the new effect.
    const channel = client
      .channel(`stock-${channelScope}-${inventoryId}-${++channelInstance}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_balances', filter: `inventory_id=eq.${inventoryId}` }, onChange)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stock_movements', filter: `inventory_id=eq.${inventoryId}` }, onChange)
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [channelScope, inventoryId, onChange]);
}
