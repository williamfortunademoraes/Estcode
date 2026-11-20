import { StyleSheet } from 'react-native';
import { Surface, Text } from 'react-native-paper';

interface MetricCardProps {
  label: string;
  value: string;
  helper: string;
}

export function MetricCard({ label, value, helper }: MetricCardProps) {
  return (
    <Surface style={styles.card} elevation={1}>
      <Text variant="labelLarge" style={styles.label}>
        {label}
      </Text>
      <Text variant="headlineMedium" style={styles.value}>
        {value}
      </Text>
      <Text variant="bodySmall" style={styles.helper}>
        {helper}
      </Text>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexBasis: 145,
    minWidth: 0,
    minHeight: 126,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  label: {
    color: '#667085',
  },
  value: {
    marginTop: 12,
    fontWeight: '700',
  },
  helper: {
    marginTop: 6,
    color: '#98A2B3',
  },
});
