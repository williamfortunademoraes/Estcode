import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Surface, Text } from 'react-native-paper';

import { useDashboard } from '@/src/features/dashboard/use-dashboard';

export function ConsultancyReport() {
  const { suggestions, insights, isLoading, error, reload } = useDashboard();

  if (isLoading) return <ActivityIndicator style={styles.loader} />;
  if (error) return <Surface style={styles.message} elevation={0}><Text style={styles.error}>{error}</Text><Button onPress={() => void reload()}>Tentar novamente</Button></Surface>;

  return (
    <View style={styles.container}>
      <Surface style={styles.card} elevation={0}>
        <Text variant="titleMedium" style={styles.cardTitle}>Reposição necessária</Text>
        <Text style={styles.criteria}>Critério: saldo atual ≤ estoque mínimo. A sugestão usa somente o estoque-alvo configurado no produto.</Text>
        {suggestions.length === 0 ? <Text style={styles.muted}>Nenhum produto abaixo do mínimo.</Text> : suggestions.map((item) => <View key={item.product_id} style={styles.row}><View style={styles.rowMain}><Text variant="titleSmall">{item.product_name}</Text><Text style={styles.muted}>Saldo {item.current_quantity} · mínimo {item.minimum_stock} · alvo {item.target_stock}</Text></View><Text variant="titleMedium" style={styles.suggestion}>{item.suggested_quantity}</Text></View>)}
      </Surface>
      <Surface style={styles.card} elevation={0}>
        <Text variant="titleMedium" style={styles.cardTitle}>Sem movimentação</Text>
        <Text style={styles.criteria}>{insights?.criteria.no_movement}</Text>
        {insights?.no_movement.length ? insights.no_movement.map((item) => <Text key={item.id} style={styles.listItem}>• {item.name}</Text>) : <Text style={styles.muted}>Não há produtos sem movimentação.</Text>}
      </Surface>
      <Surface style={styles.card} elevation={0}>
        <Text variant="titleMedium" style={styles.cardTitle}>Maior giro (últimos 30 dias)</Text>
        <Text style={styles.criteria}>{insights?.criteria.top_exits_30d}</Text>
        {insights?.top_exits_30d.length ? insights.top_exits_30d.map((item) => <View key={item.id} style={styles.row}><Text>{item.name}</Text><Text style={styles.suggestion}>{item.quantity}</Text></View>) : <Text style={styles.muted}>Ainda não há saídas no período.</Text>}
      </Surface>
      <Surface style={styles.card} elevation={0}>
        <Text variant="titleMedium" style={styles.cardTitle}>Histórico de consumo</Text>
        <Text style={styles.criteria}>{insights?.criteria.consumption_history}</Text>
        {insights?.consumption_history.length ? insights.consumption_history.map((item) => <View key={item.date} style={styles.row}><Text>{new Date(`${item.date}T00:00:00`).toLocaleDateString('pt-BR')}</Text><Text style={styles.suggestion}>{item.quantity}</Text></View>) : <Text style={styles.muted}>Ainda não há consumo registrado no período.</Text>}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  loader: { marginVertical: 28 },
  card: { padding: 18, borderRadius: 16, backgroundColor: '#FFFFFF' },
  message: { padding: 18, borderRadius: 16, backgroundColor: '#FEE4E2' },
  error: { color: '#B42318' },
  cardTitle: { fontWeight: '700' },
  criteria: { marginTop: 8, color: '#667085', lineHeight: 20 },
  muted: { marginTop: 10, color: '#667085', lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D0D5DD' },
  rowMain: { flex: 1 },
  suggestion: { color: '#155EEF', fontWeight: '700' },
  listItem: { marginTop: 10, color: '#475467' },
});
