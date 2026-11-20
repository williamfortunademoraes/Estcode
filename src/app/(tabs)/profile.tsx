import { Link, type RelativePathString } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Button, Chip, HelperText, Surface, Text } from 'react-native-paper';

import { AppScreen } from '@/src/components/AppScreen';
import { canManageUsers } from '@/src/features/auth/permissions';
import { environment } from '@/src/lib/env';
import { useAuthStore } from '@/src/store/auth-store';

const roleLabels = { admin: 'Administrador', operator: 'Operador', consultant: 'Consultor' } as const;

export default function ProfileScreen() {
  const profile = useAuthStore((state) => state.profile);
  const signOut = useAuthStore((state) => state.signOut);
  const error = useAuthStore((state) => state.error);

  return (
    <AppScreen>
      <Text variant="headlineSmall" style={styles.title}>Perfil</Text>
      <Text style={styles.muted}>Conta, permissões e configurações do aplicativo.</Text>
      <Surface style={styles.card} elevation={1}>
        <Text variant="titleMedium">{profile?.full_name || 'Usuário autenticado'}</Text>
        <Text style={styles.email}>{profile?.id}</Text>
        {profile ? <Chip compact style={styles.roleChip}>{roleLabels[profile.role]}</Chip> : null}
        <Text style={styles.muted}>Permissões são validadas novamente pelo PostgreSQL em cada operação sensível.</Text>
      </Surface>
      {canManageUsers(profile?.role ?? null) ? <Link href={'/users' as RelativePathString} asChild><Button mode="outlined" contentStyle={styles.buttonContent}>Gerenciar usuários</Button></Link> : null}
      {canManageUsers(profile?.role ?? null) ? <Link href={'/settings/catalog' as RelativePathString} asChild><Button mode="outlined" contentStyle={styles.buttonContent}>Categorias e fornecedores</Button></Link> : null}
      {canManageUsers(profile?.role ?? null) ? <Link href={'/settings/inventory' as RelativePathString} asChild><Button mode="outlined" contentStyle={styles.buttonContent}>Configurações de estoque</Button></Link> : null}
      {error ? <HelperText type="error" visible>{error}</HelperText> : null}
      <Button mode="contained-tonal" onPress={() => { void signOut(); }} contentStyle={styles.buttonContent}>Sair</Button>
      <Surface style={styles.card} elevation={0}>
        <Text variant="labelLarge">Ambiente Supabase</Text>
        <Text style={styles.status}>{environment.isSupabaseConfigured ? 'Configurado' : 'Não configurado'}</Text>
        <Text style={styles.muted}>A chave publishable/anon pode estar no cliente; a service_role nunca deve ser incluída no aplicativo.</Text>
      </Surface>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 16, fontWeight: '700' },
  muted: { marginTop: 8, color: '#667085', lineHeight: 21 },
  email: { marginTop: 6, color: '#98A2B3', fontSize: 12 },
  card: { gap: 8, marginTop: 18, padding: 18, borderRadius: 16, backgroundColor: '#FFFFFF' },
  roleChip: { alignSelf: 'flex-start', backgroundColor: '#DCE8FF' },
  buttonContent: { minHeight: 48 },
  status: { marginTop: 8, color: '#155EEF', fontWeight: '700' },
});
