import { supabase } from '@/src/lib/supabase';
import { inviteUser, listUsers, listVisibleProfiles, updateUserAccess } from '@/src/features/users/user-service';

jest.mock('@/src/lib/supabase', () => ({
  supabase: { from: jest.fn(), functions: { invoke: jest.fn() } },
}));

const client = supabase as unknown as { from: jest.Mock; functions: { invoke: jest.Mock } };
const profile = { id: 'user-1', full_name: 'Pessoa', role: 'operator', active: true, created_at: '', updated_at: '' };

describe('administrative user service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists visible profiles through the authenticated data API for history filters', async () => {
    const query = { select: jest.fn(), order: jest.fn() };
    query.select.mockReturnValue(query);
    query.order.mockResolvedValue({ data: [profile], error: null });
    client.from.mockReturnValue(query);

    await expect(listVisibleProfiles()).resolves.toEqual([profile]);
    expect(client.from).toHaveBeenCalledWith('profiles');
    expect(query.select).toHaveBeenCalledWith('id, full_name, role, active, created_at, updated_at');
    expect(query.order).toHaveBeenCalledWith('full_name');
  });

  it('lists users through the protected Edge Function', async () => {
    client.functions.invoke.mockResolvedValue({ data: { data: [profile] }, error: null });
    await expect(listUsers()).resolves.toEqual([profile]);
    expect(client.functions.invoke).toHaveBeenCalledWith('admin-users', { body: { action: 'list' } });
  });

  it('updates access through the protected Edge Function', async () => {
    client.functions.invoke.mockResolvedValue({ data: { data: profile }, error: null });
    await expect(updateUserAccess('user-1', { role: 'consultant' })).resolves.toEqual(profile);
    expect(client.functions.invoke).toHaveBeenCalledWith('admin-users', { body: { action: 'update_access', id: 'user-1', role: 'consultant' } });
  });

  it('sends invite data with an explicit action', async () => {
    client.functions.invoke.mockResolvedValue({ data: { data: { id: 'user-2' } }, error: null });
    await expect(inviteUser({ email: 'person@example.com', full_name: 'Pessoa', role: 'operator' })).resolves.toBe('user-2');
    expect(client.functions.invoke).toHaveBeenCalledWith('admin-users', { body: { action: 'invite', email: 'person@example.com', full_name: 'Pessoa', role: 'operator' } });
  });
});
