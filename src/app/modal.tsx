import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Button, Surface, Text } from 'react-native-paper';

import { AppScreen } from '@/src/components/AppScreen';

export default function AboutModal() {
  return (
    <AppScreen>
      <Surface style={styles.card} elevation={1}>
        <Text variant="headlineSmall" style={styles.title}>ESTCODE</Text>
        <Text variant="bodyMedium" style={styles.text}>
          Consultor Inteligente de Estoque — fundação do aplicativo preparada para autenticação, estoque transacional e consultoria.
        </Text>
        <Button mode="contained" onPress={() => router.back()}>Fechar</Button>
      </Surface>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 24,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontWeight: '700',
  },
  text: {
    marginVertical: 16,
    color: '#667085',
    lineHeight: 21,
  },
});
