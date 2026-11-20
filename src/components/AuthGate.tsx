import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useAuthStore } from '@/src/store/auth-store';

export function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);
  const status = useAuthStore((state) => state.status);
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (status !== 'ready' && status !== 'error') return;
    const inAuthGroup = segments[0] === '(auth)';
    const isResetPassword = segments.join('/') === '(auth)/reset-password';
    const hasIdentity = Boolean(session && profile);

    if (!hasIdentity && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (hasIdentity && inAuthGroup && !isResetPassword) {
      router.replace('/(tabs)');
    }
  }, [profile, router, segments, session, status]);

  return null;
}
