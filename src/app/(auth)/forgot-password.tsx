import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet } from 'react-native';
import { Button, HelperText, Surface, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/src/components/AppScreen';
import { useAuthStore } from '@/src/store/auth-store';
import { passwordRecoverySchema, type PasswordRecoveryInput } from '@/src/features/auth/auth-schema';

export default function ForgotPasswordScreen() {
  const requestReset = useAuthStore((state) => state.requestPasswordReset);
  const error = useAuthStore((state) => state.error);
  const status = useAuthStore((state) => state.status);
  const [sent, setSent] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm<PasswordRecoveryInput>({
    resolver: zodResolver(passwordRecoverySchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async ({ email }: PasswordRecoveryInput) => {
    const success = await requestReset(email);
    setSent(success);
  };

  return (
    <AppScreen>
      <Surface style={styles.card} elevation={1}>
        <Text variant="headlineSmall" style={styles.title}>Recuperar senha</Text>
        <Text variant="bodyMedium" style={styles.description}>Enviaremos um link seguro para redefinir sua senha.</Text>
        {sent ? <HelperText type="info" visible>Se o e-mail estiver cadastrado, você receberá as instruções em instantes.</HelperText> : null}
        {error ? <HelperText type="error" visible>{error}</HelperText> : null}
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput label="E-mail" value={value} onBlur={onBlur} onChangeText={onChange} autoCapitalize="none" keyboardType="email-address" error={Boolean(errors.email)} />
          )}
        />
        <HelperText type="error" visible={Boolean(errors.email)}>{errors.email?.message}</HelperText>
        <Button mode="contained" onPress={() => { void handleSubmit(onSubmit)(); }} loading={status === 'loading'} disabled={status === 'loading'} contentStyle={styles.buttonContent}>
          Enviar instruções
        </Button>
        <Link href="/(auth)/login" asChild><Button mode="text">Voltar para o login</Button></Link>
      </Surface>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 48, padding: 20, borderRadius: 18, backgroundColor: '#FFFFFF' },
  title: { fontWeight: '700' },
  description: { marginTop: 8, marginBottom: 18, color: '#667085', lineHeight: 21 },
  buttonContent: { minHeight: 48 },
});
