import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

interface SectionHeaderProps {
  title: string;
  description?: string;
}

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        {title}
      </Text>
      {description ? (
        <Text variant="bodyMedium" style={styles.description}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
    marginTop: 16,
    marginBottom: 20,
  },
  title: {
    fontWeight: '700',
  },
  description: {
    color: '#667085',
  },
});
