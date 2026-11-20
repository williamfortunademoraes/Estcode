import { z } from 'zod';

const environmentSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
});

const parsedEnvironment = environmentSchema.safeParse({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});

export const environment = {
  supabaseUrl: parsedEnvironment.success
    ? parsedEnvironment.data.EXPO_PUBLIC_SUPABASE_URL
    : undefined,
  supabaseAnonKey: parsedEnvironment.success
    ? parsedEnvironment.data.EXPO_PUBLIC_SUPABASE_ANON_KEY
    : undefined,
  isSupabaseConfigured:
    parsedEnvironment.success &&
    Boolean(
      parsedEnvironment.data.EXPO_PUBLIC_SUPABASE_URL &&
        parsedEnvironment.data.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    ),
};
