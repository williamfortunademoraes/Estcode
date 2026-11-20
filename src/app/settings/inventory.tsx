import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, HelperText, Surface, Switch, Text } from 'react-native-paper';

import { AppScreen } from '@/src/components/AppScreen';
import { canManageUsers } from '@/src/features/auth/permissions';
import { getInventorySettings, getSharedInventoryId, updateInventorySettings } from '@/src/features/inventory/inventory-service';
import { useAuthStore } from '@/src/store/auth-store';
import type { InventorySettings } from '@/src/types/domain';

export default function InventorySettingsScreen() {
  const role = useAuthStore((state) => state.profile?.role ?? null);
  const [settings, setSettings] = useState<InventorySettings | null>(null);
  const [inventoryId, setInventoryId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const sharedId = await getSharedInventoryId();
      setInventoryId(sharedId);
      setSettings(await getInventorySettings(sharedId));
      setError(null);
    } catch {
      setError('Não foi possível carregar as configurações do estoque.');
    } finally {
      setIsLoading(false);
    }
  };

  // This effect synchronizes the screen with the remote settings after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []);

  if (!canManageUsers(role)) {
    return <AppScreen><Surface style={styles.card} elevation={0}><Text variant="titleMedium">Acesso restrito</Text><Text style={styles.muted}>Somente administradores configuram exceções de estoque.</Text></Surface></AppScreen>;
  }

  const save = async () => {
    if (!inventoryId || !settings) return;
    setIsSaving(true);
    try {
      setSettings(await updateInventorySettings(inventoryId, {
        allow_negative_balance: settings.allow_negative_balance,
        allow_operator_adjustments: settings.allow_operator_adjustments,
      }));
      setSuccess('Configurações salvas pelo servidor.');
      setError(null);
    } catch {
      setError('Não foi possível salvar as configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppScreen>
      <Text variant="headlineSmall" style={styles.title}>Configurações de estoque</Text>
      <Text style={styles.muted}>Estas exceções alteram as regras aplicadas pelas RPCs no PostgreSQL.</Text>
      {isLoading ? <ActivityIndicator style={styles.loader} /> : null}
      {error ? <HelperText type="error" visible>{error}</HelperText> : null}
      {success ? <HelperText type="info" visible>{success}</HelperText> : null}
      {settings ? <Surface style={styles.card} elevation={1}>
        <View style={styles.settingRow}><View style={styles.settingText}><Text variant="titleMedium">Permitir saldo negativo</Text><Text style={styles.muted}>Saídas podem ultrapassar o saldo atual. Use somente com autorização administrativa.</Text></View><Switch value={settings.allow_negative_balance} onValueChange={(value) => setSettings({ ...settings, allow_negative_balance: value })} /></View>
        <View style={styles.settingRow}><View style={styles.settingText}><Text variant="titleMedium">Permitir ajustes por operadores</Text><Text style={styles.muted}>Operadores poderão registrar contagens e diferenças no estoque.</Text></View><Switch value={settings.allow_operator_adjustments} onValueChange={(value) => setSettings({ ...settings, allow_operator_adjustments: value })} /></View>
        <Button mode="contained" onPress={() => { void save(); }} loading={isSaving} disabled={isSaving} contentStyle={styles.buttonContent}>Salvar configurações</Button>
      </Surface> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 16, fontWeight: '700' },
  muted: { marginTop: 8, color: '#667085', lineHeight: 20 },
  loader: { marginVertical: 24 },
  card: { gap: 18, marginTop: 18, padding: 18, borderRadius: 18, backgroundColor: '#FFFFFF' },
  settingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  settingText: { flex: 1 },
  buttonContent: { minHeight: 48 },
});
