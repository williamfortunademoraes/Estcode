import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/src/lib/supabase';
import type { Profile } from '@/src/types/domain';

export interface AuthenticatedIdentity {
  session: Session;
  profile: Profile;
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }
  return supabase;
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    switch (error.message) {
      case 'SUPABASE_NOT_CONFIGURED':
        return 'Configure o Supabase no arquivo .env antes de entrar.';
      case 'PROFILE_NOT_FOUND':
        return 'Seu perfil ainda não foi configurado. Procure um administrador.';
      case 'PROFILE_INACTIVE':
        return 'Este usuário está inativo. Procure um administrador.';
      case 'PROFILE_NAME_REQUIRED':
        return 'Informe seu nome completo.';
      case 'PROFILE_NAME_TOO_LONG':
        return 'O nome deve ter no máximo 160 caracteres.';
      default:
        break;
    }
  }

  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('invalid login credentials')) {
    return 'E-mail ou senha inválidos.';
  }
  if (message.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar.';
  }
  if (message.includes('rate limit')) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  }
  return 'Não foi possível concluir a operação. Tente novamente.';
}

export async function loadProfile(userId: string): Promise<Profile> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  const profile = data as Profile | null;
  if (!profile) {
    throw new Error('PROFILE_NOT_FOUND');
  }
  if (!profile.active) {
    throw new Error('PROFILE_INACTIVE');
  }
  return profile;
}

export async function updateProfileName(userId: string, fullName: string): Promise<Profile> {
  const client = requireSupabase();
  const normalizedName = fullName.trim();
  if (!normalizedName) throw new Error('PROFILE_NAME_REQUIRED');
  if (normalizedName.length > 160) throw new Error('PROFILE_NAME_TOO_LONG');

  const { data, error } = await client
    .from('profiles')
    .update({ full_name: normalizedName })
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function bootstrapSession(): Promise<AuthenticatedIdentity | null> {
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  if (error) {
    throw error;
  }
  if (!data.session) {
    return null;
  }
  return {
    session: data.session,
    profile: await loadProfile(data.session.user.id),
  };
}

export async function signIn(email: string, password: string): Promise<AuthenticatedIdentity> {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }
  if (!data.session) {
    throw new Error('SESSION_NOT_CREATED');
  }
  try {
    return {
      session: data.session,
      profile: await loadProfile(data.session.user.id),
    };
  } catch (profileError) {
    await client.auth.signOut();
    throw profileError;
  }
}

export async function signOut(): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  const client = requireSupabase();
  const redirectTo = Linking.createURL('/reset-password');
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    throw error;
  }
}

export async function updatePassword(password: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.updateUser({ password });
  if (error) {
    throw error;
  }
}
