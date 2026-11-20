import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, HelperText, Surface, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/src/components/AppScreen';
import { environment } from '@/src/lib/env';
import { useAuthStore } from '@/src/store/auth-store';
import { loginSchema, type LoginInput } from '@/src/features/auth/auth-schema';

export default function LoginScreen() {
  const signIn = useAuthStore((state) => state.signIn);
  const authError = useAuthStore((state) => state.error);
  const status = useAuthStore((state) => state.status);
  const { control, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginInput) => {
    await signIn(values.email, values.password);
  };

  return (
    <AppScreen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.brand}>
          <Text variant="headlineMedium" style={styles.brandTitle}>ESTCODE</Text>
          <Text variant="bodyLarge" style={styles.brandSubtitle}>Consultor Inteligente de Estoque</Text>
        </View>
        <Surface style={styles.card} elevation={1}>
          <Text variant="headlineSmall" style={styles.title}>Acesse sua conta</Text>
          <Text variant="bodyMedium" style={styles.description}>Use suas credenciais para consultar o estoque compartilhado.</Text>
          {!environment.isSupabaseConfigured ? (
            <HelperText type="info" visible style={styles.setupMessage}>
              Supabase não configurado. Copie `.env.example` para `.env` e reinicie o Metro.
            </HelperText>
          ) : null}
          {authError ? <HelperText type="error" visible>{authError}</HelperText> : null}
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput label="E-mail" value={value} onBlur={onBlur} onChangeText={onChange} autoCapitalize="none" keyboardType="email-address" error={Boolean(errors.email)} />
            )}
          />
          <HelperText type="error" visible={Boolean(errors.email)}>{errors.email?.message}</HelperText>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput label="Senha" value={value} onBlur={onBlur} onChangeText={onChange} secureTextEntry error={Boolean(errors.password)} />
            )}
          />
          <HelperText type="error" visible={Boolean(errors.password)}>{errors.password?.message}</HelperText>
          <Button mode="contained" onPress={() => { void handleSubmit(onSubmit)(); }} loading={status === 'loading'} disabled={status === 'loading'} contentStyle={styles.buttonContent}>
            Entrar
          </Button>
          <Link href="/(auth)/forgot-password" asChild>
            <Button mode="text">Esqueci minha senha</Button>
          </Link>
        </Surface>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  brand: { marginTop: 48, marginBottom: 28 },
  brandTitle: { color: '#155EEF', fontWeight: '800', letterSpacing: 1 },
  brandSubtitle: { marginTop: 6, color: '#667085' },
  card: { padding: 20, borderRadius: 18, backgroundColor: '#FFFFFF' },
  title: { fontWeight: '700' },
  description: { marginTop: 8, marginBottom: 18, color: '#667085', lineHeight: 21 },
  setupMessage: { marginHorizontal: 0, marginBottom: 8 },
  buttonContent: { minHeight: 48 },
});
