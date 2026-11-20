import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Chip, HelperText, Menu, Surface, Switch, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/src/components/AppScreen';
import { canManageUsers } from '@/src/features/auth/permissions';
import { inviteUser, listUsers, updateUserAccess } from '@/src/features/users/user-service';
import { useAuthStore } from '@/src/store/auth-store';
import type { Profile, UserRole } from '@/src/types/domain';

const roleLabels: Record<UserRole, string> = { admin: 'Administrador', operator: 'Operador', consultant: 'Consultor' };

export default function UsersScreen() {
  const currentUserId = useAuthStore((state) => state.profile?.id);
  const role = useAuthStore((state) => state.profile?.role ?? null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openRoleMenu, setOpenRoleMenu] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('operator');
  const [inviteRoleMenuOpen, setInviteRoleMenuOpen] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try { setUsers(await listUsers()); setError(null); } catch { setError('Não foi possível carregar os usuários.'); } finally { setIsLoading(false); }
  };
  // This effect synchronizes the screen with the remote user list after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []);

  if (!canManageUsers(role)) return <AppScreen><Surface style={styles.card} elevation={0}><Text variant="titleMedium">Acesso restrito</Text><Text style={styles.muted}>Somente administradores gerenciam usuários.</Text></Surface></AppScreen>;

  const changeRole = async (userId: string, nextRole: UserRole) => {
    try { const updated = await updateUserAccess(userId, { role: nextRole }); setUsers((current) => current.map((item) => item.id === updated.id ? updated : item)); } catch { setError('Não foi possível alterar o papel.'); }
  };
  const changeActive = async (user: Profile, active: boolean) => {
    if (user.id === currentUserId && !active) { setError('Você não pode desativar a própria conta.'); return; }
    try { const updated = await updateUserAccess(user.id, { active }); setUsers((current) => current.map((item) => item.id === updated.id ? updated : item)); } catch { setError('Não foi possível alterar o status.'); }
  };
  const submitInvite = async () => {
    if (!inviteName.trim() || !inviteEmail.trim().includes('@')) { setError('Informe nome e e-mail válidos para o convite.'); return; }
    setIsInviting(true);
    try { await inviteUser({ full_name: inviteName.trim(), email: inviteEmail.trim().toLowerCase(), role: inviteRole }); setInviteName(''); setInviteEmail(''); setSuccess('Convite enviado.'); await load(); } catch { setError('Não foi possível enviar o convite. Confirme se a Edge Function admin-users está publicada.'); } finally { setIsInviting(false); }
  };

  return (
    <AppScreen>
      <View style={styles.heading}><View><Text variant="headlineSmall" style={styles.title}>Usuários</Text><Text style={styles.muted}>Controle de acesso do estoque compartilhado.</Text></View><Button compact onPress={() => void load()}>Atualizar</Button></View>
      {error ? <HelperText type="error" visible>{error}</HelperText> : null}
      {success ? <HelperText type="info" visible>{success}</HelperText> : null}
      <Surface style={styles.card} elevation={1}>
        <Text variant="titleMedium" style={styles.cardTitle}>Convidar usuário</Text>
        <TextInput label="Nome completo" value={inviteName} onChangeText={setInviteName} />
        <TextInput label="E-mail" value={inviteEmail} onChangeText={setInviteEmail} autoCapitalize="none" keyboardType="email-address" />
        <Menu visible={inviteRoleMenuOpen} onDismiss={() => setInviteRoleMenuOpen(false)} anchor={<Button mode="outlined" onPress={() => setInviteRoleMenuOpen(true)}>{roleLabels[inviteRole]}</Button>}>
          {(Object.keys(roleLabels) as UserRole[]).map((nextRole) => <Menu.Item key={nextRole} title={roleLabels[nextRole]} onPress={() => { setInviteRole(nextRole); setInviteRoleMenuOpen(false); }} />)}
        </Menu>
        <Button mode="contained" onPress={() => { void submitInvite(); }} loading={isInviting} disabled={isInviting} contentStyle={styles.buttonContent}>Enviar convite</Button>
      </Surface>
      {isLoading ? <ActivityIndicator style={styles.loader} /> : users.map((user) => <Surface key={user.id} style={styles.card} elevation={1}><View style={styles.userHeader}><View style={styles.userInfo}><Text variant="titleMedium">{user.full_name || 'Sem nome'}</Text><Text style={styles.userId}>{user.id}</Text></View><Switch value={user.active} onValueChange={(value) => void changeActive(user, value)} disabled={user.id === currentUserId} /></View><Menu visible={openRoleMenu === user.id} onDismiss={() => setOpenRoleMenu(null)} anchor={<Button mode="outlined" compact onPress={() => setOpenRoleMenu(user.id)}>{roleLabels[user.role]}</Button>}>{(Object.keys(roleLabels) as UserRole[]).map((nextRole) => <Menu.Item key={nextRole} title={roleLabels[nextRole]} onPress={() => { setOpenRoleMenu(null); void changeRole(user.id, nextRole); }} />)}</Menu><Chip compact style={user.active ? styles.activeChip : styles.inactiveChip}>{user.active ? 'Ativo' : 'Inativo'}</Chip></Surface>)}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16, marginBottom: 18, gap: 10 },
  title: { fontWeight: '700' },
  card: { gap: 12, marginBottom: 14, padding: 18, borderRadius: 16, backgroundColor: '#FFFFFF' },
  cardTitle: { fontWeight: '700' },
  userHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  userInfo: { flex: 1 },
  muted: { marginTop: 6, color: '#667085', lineHeight: 18, fontSize: 12 },
  userId: { marginTop: 5, color: '#98A2B3', fontSize: 10 },
  loader: { marginVertical: 24 },
  buttonContent: { minHeight: 48 },
  activeChip: { alignSelf: 'flex-start', backgroundColor: '#D1FADF' },
  inactiveChip: { alignSelf: 'flex-start', backgroundColor: '#FEE4E2' },
});
