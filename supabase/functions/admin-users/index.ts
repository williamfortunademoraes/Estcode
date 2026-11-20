import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const roleValues = new Set(['admin', 'operator', 'consultant']);
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function listProfiles() {
  const { data, error } = await adminClient.from('profiles').select('*').order('full_name');
  if (error) throw new Error('users_list_failed');
  return response({ data });
}

async function requireAdmin(request: Request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('unauthorized');
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) throw new Error('unauthorized');
  const { data: profile, error: profileError } = await adminClient.from('profiles').select('role, active').eq('id', userData.user.id).single();
  if (profileError || !profile?.active || profile.role !== 'admin') throw new Error('forbidden');
  return userData.user;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const actor = await requireAdmin(request);
    if (request.method === 'GET') return listProfiles();
    const payload = await request.json() as { action?: string; email?: string; full_name?: string; role?: string; id?: string; active?: boolean };
    if (request.method === 'POST') {
      if (payload.action === 'list') return listProfiles();
      if (payload.action === 'update_access') {
        if (!payload.id || (payload.role && !roleValues.has(payload.role)) || (payload.id === actor.id && (payload.active === false || (payload.role && payload.role !== 'admin')))) return response({ error: 'Alteração de acesso inválida.' }, 422);
        const changes: { role?: string; active?: boolean } = {};
        if (payload.role) changes.role = payload.role;
        if (typeof payload.active === 'boolean') changes.active = payload.active;
        const { data, error } = await adminClient.from('profiles').update(changes).eq('id', payload.id).select('*').single();
        if (error) return response({ error: 'Não foi possível atualizar o usuário.' }, 400);
        await adminClient.from('audit_logs').insert({ user_id: actor.id, action: 'user_access_updated', entity_type: 'profiles', entity_id: payload.id, metadata: changes });
        return response({ data });
      }
      const email = payload.email?.trim().toLowerCase() ?? '';
      const fullName = payload.full_name?.trim() ?? '';
      const role = payload.role ?? 'operator';
      if (!email.includes('@') || !fullName || !roleValues.has(role)) return response({ error: 'Dados de convite inválidos.' }, 422);
      const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName } });
      if (inviteError || !invited.user) return response({ error: 'Não foi possível enviar o convite.' }, 400);
      const { error: profileError } = await adminClient.from('profiles').upsert({ id: invited.user.id, full_name: fullName, role, active: true });
      if (profileError) return response({ error: 'Convite criado, mas o perfil não pôde ser configurado.' }, 400);
      await adminClient.from('audit_logs').insert({ user_id: actor.id, action: 'user_invited', entity_type: 'profiles', entity_id: invited.user.id, metadata: { role } });
      return response({ data: { id: invited.user.id } }, 201);
    }
    if (request.method === 'PATCH') {
      if (!payload.id || (payload.role && !roleValues.has(payload.role)) || (payload.id === actor.id && (payload.active === false || (payload.role && payload.role !== 'admin')))) return response({ error: 'Alteração de acesso inválida.' }, 422);
      const changes: { role?: string; active?: boolean } = {};
      if (payload.role) changes.role = payload.role;
      if (typeof payload.active === 'boolean') changes.active = payload.active;
      const { data, error } = await adminClient.from('profiles').update(changes).eq('id', payload.id).select('*').single();
      if (error) return response({ error: 'Não foi possível atualizar o usuário.' }, 400);
      await adminClient.from('audit_logs').insert({ user_id: actor.id, action: 'user_access_updated', entity_type: 'profiles', entity_id: payload.id, metadata: changes });
      return response({ data });
    }
    return response({ error: 'Método não suportado.' }, 405);
  } catch (error) {
    const message = error instanceof Error && error.message === 'forbidden' ? 'Acesso restrito.' : 'Não foi possível concluir a operação.';
    return response({ error: message }, message === 'Acesso restrito.' ? 403 : 401);
  }
});
