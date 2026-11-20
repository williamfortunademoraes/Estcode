import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import {
  bootstrapSession,
  getAuthErrorMessage,
  loadProfile,
  requestPasswordReset,
  signIn,
  signOut,
  updatePassword,
} from '@/src/features/auth/auth-service';
import { supabase } from '@/src/lib/supabase';
import type { Profile } from '@/src/types/domain';

export type AuthStatus = 'idle' | 'loading' | 'ready' | 'error';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  status: AuthStatus;
  error: string | null;
  bootstrap: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  updatePassword: (password: string) => Promise<boolean>;
  clearError: () => void;
}

let hasBootstrapped = false;
let authSubscription: { unsubscribe: () => void } | null = null;

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  status: 'idle',
  error: null,
  bootstrap: async () => {
    if (hasBootstrapped) return;
    hasBootstrapped = true;
    set({ status: 'loading', error: null });
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        set({ session });
        if (!session) {
          set({ profile: null, status: 'ready', error: null });
          return;
        }
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          setTimeout(() => {
            void loadProfile(session.user.id)
              .then((profile) => set({ profile, status: 'ready', error: null }))
              .catch((error: unknown) => set({ profile: null, status: 'error', error: getAuthErrorMessage(error) }));
          }, 0);
        }
      });
      authSubscription = data.subscription;
    }
    try {
      const identity = await bootstrapSession();
      set({ session: identity?.session ?? null, profile: identity?.profile ?? null, status: 'ready', error: null });
    } catch (error) {
      set({ session: null, profile: null, status: 'error', error: getAuthErrorMessage(error) });
    }
  },
  signIn: async (email, password) => {
    set({ status: 'loading', error: null });
    try {
      const identity = await signIn(email, password);
      set({ session: identity.session, profile: identity.profile, status: 'ready', error: null });
      return true;
    } catch (error) {
      set({ session: null, profile: null, status: 'error', error: getAuthErrorMessage(error) });
      return false;
    }
  },
  signOut: async () => {
    set({ status: 'loading', error: null });
    try {
      await signOut();
      set({ session: null, profile: null, status: 'ready', error: null });
      return true;
    } catch (error) {
      set({ status: 'error', error: getAuthErrorMessage(error) });
      return false;
    }
  },
  requestPasswordReset: async (email) => {
    set({ status: 'loading', error: null });
    try {
      await requestPasswordReset(email);
      set({ status: 'ready', error: null });
      return true;
    } catch (error) {
      set({ status: 'error', error: getAuthErrorMessage(error) });
      return false;
    }
  },
  updatePassword: async (password) => {
    set({ status: 'loading', error: null });
    try {
      await updatePassword(password);
      set({ status: 'ready', error: null });
      return true;
    } catch (error) {
      set({ status: 'error', error: getAuthErrorMessage(error) });
      return false;
    }
  },
  clearError: () => set({ error: null }),
}));

export function disposeAuthSubscription() {
  authSubscription?.unsubscribe();
  authSubscription = null;
  hasBootstrapped = false;
}
