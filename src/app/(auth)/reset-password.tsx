import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet } from 'react-native';
import { Button, HelperText, Surface, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/src/components/AppScreen';
import { useAuthStore } from '@/src/store/auth-store';
import { passwordUpdateSchema, type PasswordUpdateInput } from '@/src/features/auth/auth-schema';

export default function ResetPasswordScreen() {
  const updatePassword = useAuthStore((state) => state.updatePassword);
  const error = useAuthStore((state) => state.error);
  const status = useAuthStore((state) => state.status);
  const [updated, setUpdated] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm<PasswordUpdateInput>({
    resolver: zodResolver(passwordUpdateSchema),
    defaultValues: { password: '', passwordConfirmation: '' },
  });

  const onSubmit = async ({ password }: PasswordUpdateInput) => setUpdated(await updatePassword(password));

  return (
    <AppScreen>
      <Surface style={styles.card} elevation={1}>
        <Text variant="headlineSmall" style={styles.title}>Nova senha</Text>
        <Text variant="bodyMedium" style={styles.description}>Escolha uma senha com pelo menos 8 caracteres.</Text>
        {updated ? <HelperText type="info" visible>Senha atualizada. Você já pode entrar novamente.</HelperText> : null}
        {error ? <HelperText type="error" visible>{error}</HelperText> : null}
        <Controller control={control} name="password" render={({ field: { onChange, onBlur, value } }) => <TextInput label="Nova senha" value={value} onBlur={onBlur} onChangeText={onChange} secureTextEntry error={Boolean(errors.password)} />} />
        <HelperText type="error" visible={Boolean(errors.password)}>{errors.password?.message}</HelperText>
        <Controller control={control} name="passwordConfirmation" render={({ field: { onChange, onBlur, value } }) => <TextInput label="Confirme a nova senha" value={value} onBlur={onBlur} onChangeText={onChange} secureTextEntry error={Boolean(errors.passwordConfirmation)} />} />
        <HelperText type="error" visible={Boolean(errors.passwordConfirmation)}>{errors.passwordConfirmation?.message}</HelperText>
        <Button mode="contained" onPress={() => { void handleSubmit(onSubmit)(); }} loading={status === 'loading'} disabled={status === 'loading'} contentStyle={styles.buttonContent}>Atualizar senha</Button>
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
