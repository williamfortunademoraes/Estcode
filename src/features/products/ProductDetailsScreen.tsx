import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Button, Chip, HelperText, Surface, Text } from 'react-native-paper';

import { AppScreen } from '@/src/components/AppScreen';
import { canManageCatalog } from '@/src/features/auth/permissions';
import { getProductPricePresentation } from '@/src/features/products/product-presentation';
import { getProduct, listCategories, listSuppliers } from '@/src/features/products/product-service';
import { useAuthStore } from '@/src/store/auth-store';
import type { Category, Product, Supplier } from '@/src/types/domain';

export function ProductDetailsScreen({ productId }: { productId: string }) {
  const router = useRouter();
  const role = useAuthStore((state) => state.profile?.role ?? null);
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void Promise.all([getProduct(productId), listCategories(), listSuppliers()])
      .then(([productResult, categoryResult, supplierResult]) => {
        if (!mounted) return;
        setProduct(productResult);
        setCategories(categoryResult);
        setSuppliers(supplierResult);
      })
      .catch(() => { if (mounted) setError('Não foi possível carregar os dados do produto.'); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [productId]);

  const prices = product ? getProductPricePresentation(product, role) : null;
  const categoryName = categories.find((item) => item.id === product?.category_id)?.name ?? 'Sem categoria';
  const supplierName = suppliers.find((item) => item.id === product?.supplier_id)?.name ?? 'Sem fornecedor';

  return (
    <AppScreen>
      <Text variant="headlineSmall" style={styles.title}>Produto</Text>
      {isLoading ? <ActivityIndicator style={styles.loader} /> : null}
      {error ? <Surface style={styles.card} elevation={0}><Text style={styles.error}>{error}</Text><Button onPress={() => router.back()}>Voltar</Button></Surface> : null}
      {!isLoading && !error && product ? <>
        <Surface style={styles.hero} elevation={1}>
          {product.image_url ? <Image source={{ uri: product.image_url }} accessibilityLabel={`Imagem de ${product.name}`} style={styles.image} /> : <View accessibilityLabel={`Sem imagem para ${product.name}`} style={styles.imagePlaceholder}><Ionicons name="cube-outline" size={42} color="#667085" /><Text style={styles.muted}>Sem imagem cadastrada</Text></View>}
          <View style={styles.header}><Text variant="headlineSmall" style={styles.name}>{product.name}</Text><Chip compact>{product.active ? 'Ativo' : 'Inativo'}</Chip></View>
          <Text style={styles.muted}>{product.sku ? `SKU ${product.sku}` : 'Sem SKU'}{product.barcode ? ` · ${product.barcode}` : ''}</Text>
          {product.description ? <Text style={styles.description}>{product.description}</Text> : null}
        </Surface>
        <Surface style={styles.card} elevation={1}>
          <Text variant="titleMedium">Preços</Text>
          <View style={styles.row}><Text style={styles.muted}>Preço de venda</Text><Text variant="titleMedium" style={styles.salePrice}>{prices?.sale}</Text></View>
          {prices?.cost ? <View style={styles.row}><Text style={styles.muted}>Custo unitário</Text><Text variant="titleMedium">{prices.cost}</Text></View> : null}
        </Surface>
        <Surface style={styles.card} elevation={1}>
          <Text variant="titleMedium">Estoque e classificação</Text>
          <View style={styles.row}><Text style={styles.muted}>Unidade</Text><Text>{product.unit}</Text></View>
          <View style={styles.row}><Text style={styles.muted}>Estoque mínimo individual</Text><Text>{product.minimum_stock > 0 ? product.minimum_stock : 'Padrão global'}</Text></View>
          <View style={styles.row}><Text style={styles.muted}>Estoque-alvo</Text><Text>{product.target_stock}</Text></View>
          <View style={styles.row}><Text style={styles.muted}>Categoria</Text><Text>{categoryName}</Text></View>
          <View style={styles.row}><Text style={styles.muted}>Fornecedor</Text><Text>{supplierName}</Text></View>
        </Surface>
        {canManageCatalog(role) ? <Button mode="contained" icon="pencil" onPress={() => router.push({ pathname: '/products/[id]/edit', params: { id: product.id } })} contentStyle={styles.buttonContent}>Editar produto</Button> : null}
        <Button mode="text" onPress={() => router.back()} contentStyle={styles.buttonContent}>Voltar para produtos</Button>
      </> : null}
      {product?.active === false ? <HelperText type="info" visible>Produto inativo: permanece disponível para consulta do histórico.</HelperText> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 16, marginBottom: 14, fontWeight: '700' },
  loader: { marginVertical: 32 },
  hero: { gap: 8, padding: 18, borderRadius: 18, backgroundColor: '#FFFFFF' },
  image: { width: '100%', height: 220, borderRadius: 14, backgroundColor: '#F2F4F7' },
  imagePlaceholder: { height: 180, alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 14, backgroundColor: '#F2F4F7' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  name: { flex: 1, fontWeight: '700' },
  description: { marginTop: 8, lineHeight: 21 },
  card: { gap: 14, marginTop: 14, padding: 18, borderRadius: 18, backgroundColor: '#FFFFFF' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  muted: { color: '#667085' },
  salePrice: { color: '#175CD3' },
  error: { color: '#B42318' },
  buttonContent: { minHeight: 48 },
});
