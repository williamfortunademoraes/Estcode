import { supabase } from '@/src/lib/supabase';
import { getAuthErrorMessage, requestPasswordReset, signIn, signOut, updatePassword } from '@/src/features/auth/auth-service';

jest.mock('@/src/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

jest.mock('expo-linking', () => ({
  createURL: jest.fn(() => 'estcode://reset-password'),
}));

const client = supabase as unknown as {
  auth: {
    signInWithPassword: jest.Mock;
    signOut: jest.Mock;
    resetPasswordForEmail: jest.Mock;
    updateUser: jest.Mock;
  };
  from: jest.Mock;
};

const session = { user: { id: 'user-1' }, access_token: 'access', refresh_token: 'refresh' };
const profile = { id: 'user-1', full_name: 'Pessoa', role: 'operator', active: true, created_at: '', updated_at: '' };

function prepareProfileQuery(data: unknown, error: unknown = null) {
  const query = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data, error });
  client.from.mockReturnValue(query);
}

describe('auth service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('signs in and loads the active profile', async () => {
    client.auth.signInWithPassword.mockResolvedValue({ data: { session }, error: null });
    prepareProfileQuery(profile);
    await expect(signIn('person@example.com', 'secret123')).resolves.toMatchObject({ profile });
  });

  it('signs out when the profile is inactive', async () => {
    client.auth.signInWithPassword.mockResolvedValue({ data: { session }, error: null });
    client.auth.signOut.mockResolvedValue({ error: null });
    prepareProfileQuery({ ...profile, active: false });
    await expect(signIn('person@example.com', 'secret123')).rejects.toThrow('PROFILE_INACTIVE');
    expect(client.auth.signOut).toHaveBeenCalled();
  });

  it('supports password recovery and logout', async () => {
    client.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    client.auth.updateUser.mockResolvedValue({ error: null });
    client.auth.signOut.mockResolvedValue({ error: null });
    await expect(requestPasswordReset('person@example.com')).resolves.toBeUndefined();
    await expect(updatePassword('secret123')).resolves.toBeUndefined();
    await expect(signOut()).resolves.toBeUndefined();
  });

  it('returns safe user-facing messages', () => {
    expect(getAuthErrorMessage(new Error('Invalid login credentials'))).toBe('E-mail ou senha inválidos.');
    expect(getAuthErrorMessage(new Error('unexpected internal details'))).toContain('Não foi possível');
  });
});
