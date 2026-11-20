import { useRouter, type RelativePathString } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Divider, Surface, Text } from 'react-native-paper';

import { AppScreen } from '@/src/components/AppScreen';
import { MetricCard } from '@/src/components/MetricCard';
import { ConsultancyReport } from '@/src/features/consultancy/ConsultancyReport';
import { useDashboard } from '@/src/features/dashboard/use-dashboard';

export default function DashboardScreen() {
  const router = useRouter();
  const { metrics, recentMovements, isLoading, error, reload } = useDashboard();

  return (
    <AppScreen>
      <View style={styles.heading}><View><Text variant="headlineSmall" style={styles.title}>Visão geral</Text><Text style={styles.muted}>Indicadores do estoque compartilhado.</Text></View><Button compact onPress={() => void reload()}>Atualizar</Button></View>
      {isLoading ? <ActivityIndicator style={styles.loader} /> : null}
      {error ? <Surface style={styles.errorCard} elevation={0}><Text style={styles.error}>{error}</Text></Surface> : null}
      {metrics ? <View style={styles.metricsGrid}>
        <MetricCard label="Produtos" value={String(metrics.total_products)} helper="Ativos" />
        <MetricCard label="Em estoque" value={String(metrics.total_quantity)} helper="Quantidade total" />
        <MetricCard label="Estoque mínimo" value={String(metrics.below_minimum)} helper="Reposição necessária" />
        <MetricCard label="Movimentações" value={String(metrics.movements_30d)} helper="Últimos 30 dias" />
        <MetricCard label="Entradas" value={String(metrics.entries_30d)} helper="Últimos 30 dias" />
        <MetricCard label="Saídas" value={String(metrics.exits_30d)} helper="Últimos 30 dias" />
      </View> : null}
      <View style={styles.actions}><Button mode="contained" icon="barcode-scan" onPress={() => router.push('/scanner')} contentStyle={styles.buttonContent}>Abrir scanner</Button><Button mode="outlined" icon="cube-outline" onPress={() => router.push('/products')} contentStyle={styles.buttonContent}>Consultar produtos</Button><Button mode="text" onPress={() => router.push('/reports' as RelativePathString)}>Abrir relatórios e consultoria</Button></View>
      <Text variant="titleMedium" style={styles.sectionTitle}>Consultoria de reposição</Text>
      <ConsultancyReport />
      <Text variant="titleMedium" style={styles.sectionTitle}>Últimas movimentações</Text>
      <Surface style={styles.history} elevation={0}>
        {!recentMovements.length ? <Text style={styles.muted}>Nenhuma movimentação registrada.</Text> : recentMovements.map((movement) => <View key={movement.id} style={styles.historyRow}><View><Text variant="titleSmall">{movement.product_name}</Text><Text style={styles.muted}>{movement.user_name} · {movement.reason}</Text></View><Text style={movement.movement_type === 'exit' ? styles.exit : styles.entry}>{movement.movement_type === 'exit' ? '-' : '+'}{Math.abs(movement.quantity)}</Text></View>)}
        {recentMovements.length ? <Divider style={styles.divider} /> : null}
        <Text variant="bodySmall" style={styles.muted}>Os dados são retornados pelo banco e não são simulados.</Text>
      </Surface>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16, marginBottom: 20, gap: 10 },
  title: { fontWeight: '700' },
  muted: { marginTop: 6, color: '#667085', lineHeight: 20 },
  loader: { marginVertical: 24 },
  errorCard: { padding: 16, borderRadius: 16, backgroundColor: '#FEE4E2' },
  error: { color: '#B42318' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actions: { gap: 8, marginTop: 20 },
  buttonContent: { minHeight: 48 },
  sectionTitle: { marginTop: 24, marginBottom: 12, fontWeight: '700' },
  history: { padding: 18, borderRadius: 16, backgroundColor: '#EEF2F6' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 10 },
  divider: { marginVertical: 8 },
  entry: { color: '#039855', fontWeight: '700' },
  exit: { color: '#D92D20', fontWeight: '700' },
});
