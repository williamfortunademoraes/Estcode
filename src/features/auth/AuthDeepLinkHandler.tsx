import * as Linking from 'expo-linking';
import { useEffect } from 'react';

import { supabase } from '@/src/lib/supabase';

function extractSessionTokens(url: string): { accessToken: string; refreshToken: string } | null {
  const fragment = url.split('#')[1] ?? '';
  const query = url.split('?')[1]?.split('#')[0] ?? '';
  const params = new URLSearchParams(fragment || query);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

export function AuthDeepLinkHandler() {
  useEffect(() => {
    const client = supabase;
    if (!client) return undefined;
    const applyUrl = (url: string) => {
      const tokens = extractSessionTokens(url);
      if (tokens) void client.auth.setSession({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken });
    };
    void Linking.getInitialURL().then((url) => { if (url) applyUrl(url); });
    const subscription = Linking.addEventListener('url', ({ url }) => applyUrl(url));
    return () => subscription.remove();
  }, []);

  return null;
}
