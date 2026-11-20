import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, HelperText, Surface, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/src/components/AppScreen';
import { canManageCatalog } from '@/src/features/auth/permissions';
import {
  createCategory,
  createSupplier,
  listCategories,
  listSuppliers,
  updateCategory,
  updateSupplier,
} from '@/src/features/products/product-service';
import { useAuthStore } from '@/src/store/auth-store';
import type { Category, Supplier } from '@/src/types/domain';

interface CategoryForm { name: string; description: string; }
interface SupplierForm { name: string; document: string; phone: string; email: string; }

export default function CatalogSettingsScreen() {
  const role = useAuthStore((state) => state.profile?.role ?? null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const categoryForm = useForm<CategoryForm>({ defaultValues: { name: '', description: '' } });
  const supplierForm = useForm<SupplierForm>({ defaultValues: { name: '', document: '', phone: '', email: '' } });

  const load = async () => {
    try {
      const [categoryResult, supplierResult] = await Promise.all([listCategories(), listSuppliers()]);
      setCategories(categoryResult);
      setSuppliers(supplierResult);
      setError(null);
    } catch {
      setError('Não foi possível carregar categorias e fornecedores.');
    }
  };

  // This effect synchronizes the screen with the remote catalog after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []);

  if (!canManageCatalog(role)) {
    return <AppScreen><Surface style={styles.card} elevation={0}><Text variant="titleMedium">Acesso restrito</Text><Text style={styles.muted}>Somente administradores gerenciam cadastros auxiliares.</Text></Surface></AppScreen>;
  }

  const submitCategory = async (values: CategoryForm) => {
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, { name: values.name, description: values.description.trim() || null, active: true });
      } else {
        await createCategory(values.name, values.description.trim() || null);
      }
      categoryForm.reset();
      setEditingCategory(null);
      setSuccess(editingCategory ? 'Categoria atualizada.' : 'Categoria cadastrada.');
      await load();
    } catch {
      setError('Não foi possível salvar a categoria.');
    }
  };

  const submitSupplier = async (values: SupplierForm) => {
    try {
      const changes = { name: values.name, document: values.document.trim() || null, phone: values.phone.trim() || null, email: values.email.trim() || null, active: true };
      if (editingSupplier) await updateSupplier(editingSupplier.id, changes);
      else await createSupplier(changes);
      supplierForm.reset();
      setEditingSupplier(null);
      setSuccess(editingSupplier ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado.');
      await load();
    } catch {
      setError('Não foi possível salvar o fornecedor.');
    }
  };

  const archiveCategory = (item: Category) => {
    Alert.alert('Desativar categoria', `A categoria “${item.name}” deixará de aparecer em novos produtos.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desativar', style: 'destructive', onPress: () => { void updateCategory(item.id, { name: item.name, description: item.description, active: false }).then(load).catch(() => setError('Não foi possível desativar a categoria.')); } },
    ]);
  };

  const archiveSupplier = (item: Supplier) => {
    Alert.alert('Desativar fornecedor', `O fornecedor “${item.name}” deixará de aparecer em novos produtos.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desativar', style: 'destructive', onPress: () => { void updateSupplier(item.id, { name: item.name, document: item.document, phone: item.phone, email: item.email, active: false }).then(load).catch(() => setError('Não foi possível desativar o fornecedor.')); } },
    ]);
  };

  return (
    <AppScreen>
      <Text variant="headlineSmall" style={styles.title}>Cadastros auxiliares</Text>
      <Text style={styles.muted}>Categorias e fornecedores usados nos produtos.</Text>
      {error ? <HelperText type="error" visible>{error}</HelperText> : null}
      {success ? <HelperText type="info" visible>{success}</HelperText> : null}

      <Surface style={styles.card} elevation={1}>
        <Text variant="titleMedium" style={styles.cardTitle}>{editingCategory ? 'Editar categoria' : 'Nova categoria'}</Text>
        <Controller control={categoryForm.control} name="name" render={({ field: { onChange, value } }) => <TextInput label="Nome" value={value} onChangeText={onChange} />} />
        <Controller control={categoryForm.control} name="description" render={({ field: { onChange, value } }) => <TextInput label="Descrição" value={value} onChangeText={onChange} />} />
        <Button mode="contained" onPress={() => { void categoryForm.handleSubmit(submitCategory)(); }} contentStyle={styles.buttonContent}>{editingCategory ? 'Salvar categoria' : 'Cadastrar categoria'}</Button>
        {editingCategory ? <Button onPress={() => { setEditingCategory(null); categoryForm.reset(); }}>Cancelar edição</Button> : null}
        <View style={styles.list}>{categories.map((item) => <View key={item.id} style={styles.listRow}><Text style={styles.listItem}>{item.name}</Text><Button compact onPress={() => { setEditingCategory(item); categoryForm.reset({ name: item.name, description: item.description ?? '' }); }}>Editar</Button><Button compact textColor="#D92D20" onPress={() => archiveCategory(item)}>Desativar</Button></View>)}</View>
      </Surface>

      <Surface style={styles.card} elevation={1}>
        <Text variant="titleMedium" style={styles.cardTitle}>{editingSupplier ? 'Editar fornecedor' : 'Novo fornecedor'}</Text>
        <Controller control={supplierForm.control} name="name" render={({ field: { onChange, value } }) => <TextInput label="Nome" value={value} onChangeText={onChange} />} />
        <Controller control={supplierForm.control} name="document" render={({ field: { onChange, value } }) => <TextInput label="Documento" value={value} onChangeText={onChange} />} />
        <Controller control={supplierForm.control} name="phone" render={({ field: { onChange, value } }) => <TextInput label="Telefone" value={value} onChangeText={onChange} />} />
        <Controller control={supplierForm.control} name="email" render={({ field: { onChange, value } }) => <TextInput label="E-mail" value={value} onChangeText={onChange} autoCapitalize="none" keyboardType="email-address" />} />
        <Button mode="contained" onPress={() => { void supplierForm.handleSubmit(submitSupplier)(); }} contentStyle={styles.buttonContent}>{editingSupplier ? 'Salvar fornecedor' : 'Cadastrar fornecedor'}</Button>
        {editingSupplier ? <Button onPress={() => { setEditingSupplier(null); supplierForm.reset(); }}>Cancelar edição</Button> : null}
        <View style={styles.list}>{suppliers.map((item) => <View key={item.id} style={styles.listRow}><Text style={styles.listItem}>{item.name}</Text><Button compact onPress={() => { setEditingSupplier(item); supplierForm.reset({ name: item.name, document: item.document ?? '', phone: item.phone ?? '', email: item.email ?? '' }); }}>Editar</Button><Button compact textColor="#D92D20" onPress={() => archiveSupplier(item)}>Desativar</Button></View>)}</View>
      </Surface>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 16, fontWeight: '700' },
  muted: { marginTop: 8, marginBottom: 18, color: '#667085', lineHeight: 21 },
  card: { gap: 10, marginBottom: 16, padding: 18, borderRadius: 16, backgroundColor: '#FFFFFF' },
  cardTitle: { fontWeight: '700' },
  buttonContent: { minHeight: 48 },
  list: { gap: 6, marginTop: 6 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D0D5DD', paddingTop: 6 },
  listItem: { flex: 1, color: '#475467' },
});
