import { supabase } from '@/src/lib/supabase';
import type { Profile, UserRole } from '@/src/types/domain';

function requireSupabase() {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
  return supabase;
}

export async function listVisibleProfiles(): Promise<Profile[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('id, full_name, role, active, created_at, updated_at')
    .order('full_name');
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function listUsers(): Promise<Profile[]> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke<{ data: Profile[]; error?: string }>('admin-users', { body: { action: 'list' } });
  if (error || !data?.data) throw error ?? new Error(data?.error ?? 'USERS_LIST_FAILED');
  return data.data;
}

export async function updateUserAccess(userId: string, changes: { role?: UserRole; active?: boolean }): Promise<Profile> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke<{ data: Profile; error?: string }>('admin-users', { body: { action: 'update_access', id: userId, ...changes } });
  if (error || !data?.data) throw error ?? new Error(data?.error ?? 'USER_ACCESS_UPDATE_FAILED');
  return data.data;
}

export async function inviteUser(input: { email: string; full_name: string; role: UserRole }): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke<{ data: { id: string }; error?: string }>('admin-users', { body: { action: 'invite', ...input } });
  if (error || !data?.data.id) throw error ?? new Error(data?.error ?? 'INVITE_FAILED');
  return data.data.id;
}
