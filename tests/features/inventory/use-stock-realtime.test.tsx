import { renderHook } from '@testing-library/react-native';
import { useStockRealtime } from '@/src/features/inventory/use-stock-realtime';

type MockChannel = { subscribed: boolean; on: () => MockChannel; subscribe: () => MockChannel };

jest.mock('@/src/lib/supabase', () => {
  const channels = new Map<string, MockChannel>();

  return {
    supabase: {
      __channels: channels,
      channel: (name: string) => {
        let channel = channels.get(name);
        if (!channel) {
          const newChannel: MockChannel = {
            subscribed: false,
            on: () => {
              if (newChannel.subscribed) {
                throw new Error('cannot add postgres_changes callbacks after subscribe()');
              }
              return newChannel;
            },
            subscribe: () => {
              newChannel.subscribed = true;
              return newChannel;
            },
          };
          channel = newChannel;
          channels.set(name, channel);
        }
        return channel;
      },
      removeChannel: async () => undefined,
    },
  };
});

describe('useStockRealtime', () => {
  it('uses separate channels when dashboard and inventory subscribe to the same inventory', async () => {
    const dashboard = await renderHook(() => useStockRealtime('inventory-1', 'dashboard', jest.fn()));
    const inventory = await renderHook(() => useStockRealtime('inventory-1', 'inventory', jest.fn()));

    await dashboard.unmount();
    await inventory.unmount();
  });

  it('creates a fresh channel when the hook is remounted quickly', async () => {
    const first = await renderHook(() => useStockRealtime('inventory-1', 'dashboard', jest.fn()));
    await first.unmount();

    const second = await renderHook(() => useStockRealtime('inventory-1', 'dashboard', jest.fn()));

    await second.unmount();
  });
});
