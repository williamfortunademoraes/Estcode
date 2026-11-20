import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { environment } from './env';
import type { Database } from '@/src/types/database';

type SessionStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const webStorage: SessionStorage = {
  getItem: async (key) =>
    typeof window === 'undefined' ? null : window.localStorage.getItem(key),
  setItem: async (key, value) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
  },
  removeItem: async (key) => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }
  },
};

const sessionStorage: SessionStorage = Platform.OS === 'web' ? webStorage : AsyncStorage;

export const supabase: SupabaseClient<Database> | null =
  environment.isSupabaseConfigured &&
  environment.supabaseUrl &&
  environment.supabaseAnonKey
    ? createClient<Database>(
        environment.supabaseUrl,
        environment.supabaseAnonKey,
        {
          auth: {
            storage: sessionStorage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: Platform.OS === 'web',
          },
        },
      )
    : null;
