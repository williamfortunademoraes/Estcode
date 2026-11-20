import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { Alert, Image, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button, HelperText, Menu, Surface, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/src/components/AppScreen';
import { canManageCatalog } from '@/src/features/auth/permissions';
import { useAuthStore } from '@/src/store/auth-store';
import type { Category, Supplier } from '@/src/types/domain';
import {
  createProduct,
  deactivateProduct,
  getProduct,
  listCategories,
  listSuppliers,
  saveProductImage,
  updateProduct,
} from './product-service';
import { getProductErrorMessage } from './product-error';
import { productSchema, type ProductInput } from './product-schema';

interface ProductFormScreenProps {
  productId?: string;
  initialBarcode?: string | null;
}

const emptyProduct = (initialBarcode: string | null): ProductInput => ({
  name: '', sku: null, barcode: initialBarcode, description: null, category_id: null, supplier_id: null,
  unit: 'un', minimum_stock: 0, target_stock: 0, cost_price: null, sale_price: null, active: true,
});

export function ProductFormScreen({ productId, initialBarcode = null }: ProductFormScreenProps) {
  const router = useRouter();
  const role = useAuthStore((state) => state.profile?.role ?? null);
  const [persistedProductId, setPersistedProductId] = useState(productId);
  const [selectedImage, setSelectedImage] = useState<{ uri: string; mimeType: string | null } | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(Boolean(productId));
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [supplierMenuOpen, setSupplierMenuOpen] = useState(false);
  const { control, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<ProductInput>({
    resolver: zodResolver(productSchema) as unknown as Resolver<ProductInput>,
    defaultValues: emptyProduct(initialBarcode),
  });

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      listCategories(),
      listSuppliers(),
      productId ? getProduct(productId) : Promise.resolve(null),
    ])
      .then(([categoryResult, supplierResult, product]) => {
        if (!mounted) return;
        setCategories(categoryResult);
        setSuppliers(supplierResult);
        setSelectedCategoryId(product?.category_id ?? null);
        setSelectedSupplierId(product?.supplier_id ?? null);
        setExistingImageUrl(product?.image_url ?? null);
        if (product) reset({ ...product, description: product.description, sku: product.sku, barcode: product.barcode, category_id: product.category_id, supplier_id: product.supplier_id, cost_price: product.cost_price, sale_price: product.sale_price });
        setLoadError(null);
      })
      .catch(() => { if (mounted) setLoadError('Não foi possível carregar os dados do formulário.'); })
      .finally(() => { if (mounted) setIsLoadingData(false); });
    return () => { mounted = false; };
  }, [productId, reset]);

  const selectedCategory = useMemo(() => categories.find((item) => item.id === selectedCategoryId), [categories, selectedCategoryId]);
  const selectedSupplier = useMemo(() => suppliers.find((item) => item.id === selectedSupplierId), [selectedSupplierId, suppliers]);

  if (!canManageCatalog(role)) {
    return <AppScreen><Surface style={styles.card} elevation={0}><Text variant="titleMedium">Acesso restrito</Text><Text style={styles.muted}>Somente administradores podem cadastrar ou editar produtos.</Text></Surface></AppScreen>;
  }

  const onSubmit = async (values: ProductInput) => {
    setSubmitError(null);
    try {
      const savedProduct = persistedProductId
        ? await updateProduct(persistedProductId, values)
        : await createProduct(values);
      setPersistedProductId(savedProduct.id);
      if (selectedImage) {
        await saveProductImage(savedProduct.id, selectedImage.uri, selectedImage.mimeType);
        setSelectedImage(null);
      }
      router.back();
    } catch (error) {
      setSubmitError(getProductErrorMessage(error));
    }
  };

  const handleImagePickerResult = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets[0]) return;
    setSelectedImage({ uri: result.assets[0].uri, mimeType: result.assets[0].mimeType ?? null });
    setExistingImageUrl(null);
    setSubmitError(null);
  };

  const selectProductImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      handleImagePickerResult(result);
    } catch {
      setSubmitError('Não foi possível abrir a galeria de imagens.');
    }
  };

  const captureProductImage = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setSubmitError('Permita o acesso à câmera para fotografar o produto.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      handleImagePickerResult(result);
    } catch {
      setSubmitError('Não foi possível abrir a câmera.');
    }
  };

  const confirmDeactivate = () => {
    if (!persistedProductId) return;
    Alert.alert('Desativar produto', 'O produto ficará fora do catálogo, mas seu histórico será preservado.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desativar', style: 'destructive', onPress: () => { void deactivateProduct(persistedProductId).then(() => router.back()).catch((error) => setSubmitError(getProductErrorMessage(error))); } },
    ]);
  };

  if (isLoadingData) return <AppScreen><Text style={styles.muted}>Carregando formulário…</Text></AppScreen>;
  if (loadError) return <AppScreen><HelperText type="error" visible>{loadError}</HelperText></AppScreen>;

  return (
    <AppScreen>
      <Text variant="headlineSmall" style={styles.title}>{persistedProductId ? 'Editar produto' : 'Novo produto'}</Text>
      <Text style={styles.muted}>Campos com informação consistente evitam duplicidade e melhoram a reposição.</Text>
      {submitError ? <HelperText type="error" visible>{submitError}</HelperText> : null}
      <Surface style={styles.card} elevation={1}>
        <Text variant="titleMedium">Imagem do produto</Text>
        {selectedImage?.uri || existingImageUrl ? <Image source={{ uri: selectedImage?.uri ?? existingImageUrl ?? undefined }} accessibilityLabel="Prévia da imagem do produto" style={styles.imagePreview} /> : <View style={styles.imagePlaceholder}><Text style={styles.muted}>Adicione uma foto para identificar o produto.</Text></View>}
        <View style={styles.imageActions}>
          <Button mode="outlined" icon="image-plus" onPress={() => { void selectProductImage(); }}>Galeria</Button>
          <Button mode="outlined" icon="camera" onPress={() => { void captureProductImage(); }}>Câmera</Button>
        </View>
        <Text style={styles.muted}>JPG, PNG ou WebP · até 8 MB</Text>
        <Controller control={control} name="name" render={({ field: { onChange, onBlur, value } }) => <TextInput label="Nome *" value={value} onBlur={onBlur} onChangeText={onChange} error={Boolean(errors.name)} />} />
        <HelperText type="error" visible={Boolean(errors.name)}>{errors.name?.message}</HelperText>
        <Controller control={control} name="sku" render={({ field: { onChange, onBlur, value } }) => <TextInput label="SKU / código interno" value={value ?? ''} onBlur={onBlur} onChangeText={onChange} error={Boolean(errors.sku)} />} />
        <HelperText type="error" visible={Boolean(errors.sku)}>{errors.sku?.message}</HelperText>
        <Controller control={control} name="barcode" render={({ field: { onChange, onBlur, value } }) => <TextInput label="EAN / GTIN" value={value ?? ''} onBlur={onBlur} onChangeText={onChange} keyboardType="number-pad" error={Boolean(errors.barcode)} />} />
        <HelperText type="error" visible={Boolean(errors.barcode)}>{errors.barcode?.message}</HelperText>
        <Controller control={control} name="unit" render={({ field: { onChange, onBlur, value } }) => <TextInput label="Unidade *" value={value} onBlur={onBlur} onChangeText={onChange} error={Boolean(errors.unit)} />} />
        <Controller control={control} name="description" render={({ field: { onChange, onBlur, value } }) => <TextInput label="Descrição" value={value ?? ''} onBlur={onBlur} onChangeText={onChange} multiline />} />
        <Controller control={control} name="minimum_stock" render={({ field: { onChange, value } }) => <TextInput label="Estoque mínimo individual (0 usa o padrão global) *" value={String(value)} onChangeText={(text) => onChange(Number(text.replace(',', '.')) || 0)} keyboardType="decimal-pad" error={Boolean(errors.minimum_stock)} />} />
        <Controller control={control} name="target_stock" render={({ field: { onChange, value } }) => <TextInput label="Estoque-alvo *" value={String(value)} onChangeText={(text) => onChange(Number(text.replace(',', '.')) || 0)} keyboardType="decimal-pad" error={Boolean(errors.target_stock)} />} />
        <HelperText type="error" visible={Boolean(errors.target_stock)}>{errors.target_stock?.message}</HelperText>
        <Controller control={control} name="cost_price" render={({ field: { onChange, value } }) => <TextInput label="Custo unitário" value={value == null ? '' : String(value)} onChangeText={(text) => onChange(text.trim() === '' ? null : Number(text.replace(',', '.')))} keyboardType="decimal-pad" />} />
        <Controller control={control} name="sale_price" render={({ field: { onChange, value } }) => <TextInput label="Preço de venda" value={value == null ? '' : String(value)} onChangeText={(text) => onChange(text.trim() === '' ? null : Number(text.replace(',', '.')))} keyboardType="decimal-pad" />} />
        <Menu visible={categoryMenuOpen} onDismiss={() => setCategoryMenuOpen(false)} anchor={<Button mode="outlined" onPress={() => setCategoryMenuOpen(true)}>{selectedCategory?.name ?? 'Selecionar categoria'}</Button>}>
          <Menu.Item onPress={() => { setValue('category_id', null); setSelectedCategoryId(null); setCategoryMenuOpen(false); }} title="Sem categoria" />
          {categories.map((category) => <Menu.Item key={category.id} onPress={() => { setValue('category_id', category.id); setSelectedCategoryId(category.id); setCategoryMenuOpen(false); }} title={category.name} />)}
        </Menu>
        <Menu visible={supplierMenuOpen} onDismiss={() => setSupplierMenuOpen(false)} anchor={<Button mode="outlined" onPress={() => setSupplierMenuOpen(true)}>{selectedSupplier?.name ?? 'Selecionar fornecedor'}</Button>}>
          <Menu.Item onPress={() => { setValue('supplier_id', null); setSelectedSupplierId(null); setSupplierMenuOpen(false); }} title="Sem fornecedor" />
          {suppliers.map((supplier) => <Menu.Item key={supplier.id} onPress={() => { setValue('supplier_id', supplier.id); setSelectedSupplierId(supplier.id); setSupplierMenuOpen(false); }} title={supplier.name} />)}
        </Menu>
        <Button mode="contained" onPress={() => { void handleSubmit(onSubmit)(); }} loading={isSubmitting} disabled={isSubmitting} contentStyle={styles.buttonContent}>{persistedProductId ? 'Salvar alterações' : 'Cadastrar produto'}</Button>
        {persistedProductId ? <Button mode="text" textColor="#D92D20" onPress={confirmDeactivate}>Desativar produto</Button> : null}
      </Surface>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 16, fontWeight: '700' },
  muted: { marginTop: 8, marginBottom: 18, color: '#667085', lineHeight: 21 },
  card: { gap: 8, padding: 18, borderRadius: 18, backgroundColor: '#FFFFFF' },
  imagePreview: { width: '100%', height: 220, borderRadius: 14, backgroundColor: '#F2F4F7' },
  imagePlaceholder: { minHeight: 112, alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 14, backgroundColor: '#F2F4F7' },
  imageActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  buttonContent: { minHeight: 48 },
});
