import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { AppScreen } from '@/src/components/AppScreen';
import { ConsultancyReport } from '@/src/features/consultancy/ConsultancyReport';

export default function ReportsScreen() {
  return <AppScreen><Text variant="headlineSmall" style={styles.title}>Relatórios e consultoria</Text><Text style={styles.muted}>Critérios determinísticos e explicáveis baseados no estoque e no histórico.</Text><ConsultancyReport /></AppScreen>;
}

const styles = StyleSheet.create({ title: { marginTop: 16, fontWeight: '700' }, muted: { marginTop: 8, marginBottom: 18, color: '#667085', lineHeight: 21 } });
