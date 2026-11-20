import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Button, Chip, Menu, Searchbar, Surface, Text } from 'react-native-paper';

import { AppScreen } from '@/src/components/AppScreen';
import { canManageCatalog } from '@/src/features/auth/permissions';
import { getProductPricePresentation } from '@/src/features/products/product-presentation';
import { listCategories } from '@/src/features/products/product-service';
import { useProducts } from '@/src/features/products/use-products';
import { useAuthStore } from '@/src/store/auth-store';
import type { Category, Product, UserRole } from '@/src/types/domain';

function ProductRow({ product, role, onPress }: { product: Product; role: UserRole | null; onPress: () => void }) {
  const prices = getProductPricePresentation(product, role);
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Surface style={styles.productCard} elevation={1}>
        <View style={styles.productContent}>
          {product.image_url ? <Image source={{ uri: product.image_url }} accessibilityLabel={`Imagem de ${product.name}`} style={styles.thumbnail} /> : <View accessibilityLabel={`Sem imagem para ${product.name}`} style={styles.thumbnailPlaceholder}><Ionicons name="cube-outline" size={25} color="#667085" /></View>}
          <View style={styles.productInfo}>
            <View style={styles.productHeader}>
              <Text variant="titleMedium" style={styles.productName}>{product.name}</Text>
              <Chip compact>{product.unit}</Chip>
            </View>
            <Text variant="bodySmall" style={styles.muted}>{product.sku ?? 'Sem SKU'}{product.barcode ? ` · ${product.barcode}` : ''}</Text>
            <View style={styles.priceRow}>
              <View><Text variant="labelSmall" style={styles.muted}>Venda</Text><Text variant="titleSmall" style={styles.price}>{prices.sale}</Text></View>
              {prices.cost ? <View><Text variant="labelSmall" style={styles.muted}>Custo</Text><Text variant="titleSmall" style={styles.cost}>{prices.cost}</Text></View> : null}
            </View>
          </View>
        </View>
        <Text variant="bodyMedium" style={styles.stockText}>Mínimo: {product.minimum_stock > 0 ? product.minimum_stock : 'padrão global'} · Alvo: {product.target_stock}</Text>
      </Surface>
    </Pressable>
  );
}

export default function ProductsScreen() {
  const router = useRouter();
  const role = useAuthStore((state) => state.profile?.role ?? null);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const { products, isLoading, error, reload } = useProducts(search, categoryId);

  useEffect(() => {
    void listCategories().then(setCategories).catch(() => setCategoryError('Não foi possível carregar os filtros de categoria.'));
  }, []);

  const selectedCategory = categories.find((category) => category.id === categoryId);

  return (
    <AppScreen>
      <View style={styles.heading}>
        <View>
          <Text variant="headlineSmall" style={styles.title}>Produtos</Text>
          <Text variant="bodyMedium" style={styles.muted}>Pesquise por nome, SKU ou código de barras.</Text>
        </View>
        {canManageCatalog(role) ? <Button mode="contained" compact onPress={() => router.push('/products/new')}>Novo</Button> : null}
      </View>
      <Searchbar placeholder="Buscar produto" value={search} onChangeText={setSearch} accessibilityLabel="Buscar produtos" />
      <Menu
        visible={categoryMenuOpen}
        onDismiss={() => setCategoryMenuOpen(false)}
        anchor={<Button mode="outlined" icon="filter-variant" onPress={() => setCategoryMenuOpen(true)}>{selectedCategory?.name ?? 'Todas as categorias'}</Button>}
      >
        <Menu.Item title="Todas as categorias" onPress={() => { setCategoryId(undefined); setCategoryMenuOpen(false); }} />
        {categories.map((category) => <Menu.Item key={category.id} title={category.name} onPress={() => { setCategoryId(category.id); setCategoryMenuOpen(false); }} />)}
      </Menu>
      {categoryError ? <Text style={styles.error}>{categoryError}</Text> : null}
      {isLoading ? <ActivityIndicator style={styles.loader} /> : null}
      {error ? <Surface style={styles.messageCard} elevation={0}><Text style={styles.error}>{error}</Text><Button mode="text" onPress={reload}>Tentar novamente</Button></Surface> : null}
      {!isLoading && !error && products.length === 0 ? <Surface style={styles.messageCard} elevation={0}><Text variant="titleMedium">Nenhum produto encontrado</Text><Text style={styles.muted}>Cadastros ativos aparecerão aqui após a sincronização com o Supabase.</Text></Surface> : null}
      <View style={styles.list}>{products.map((product) => <ProductRow key={product.id} product={product} role={role} onPress={() => router.push({ pathname: '/products/[id]', params: { id: product.id } })} />)}</View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 16, marginBottom: 16, gap: 12 },
  title: { fontWeight: '700' },
  muted: { marginTop: 6, color: '#667085', lineHeight: 20 },
  loader: { marginVertical: 24 },
  list: { gap: 12, marginTop: 18 },
  productCard: { padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF' },
  productContent: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  productInfo: { flex: 1, gap: 4 },
  thumbnail: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#F2F4F7' },
  thumbnailPlaceholder: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  productHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  productName: { flex: 1, fontWeight: '700' },
  stockText: { marginTop: 8, color: '#475467' },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, marginTop: 10 },
  price: { marginTop: 2, color: '#175CD3' },
  cost: { marginTop: 2, color: '#475467' },
  messageCard: { marginTop: 18, padding: 18, borderRadius: 16, backgroundColor: '#EEF2F6' },
  error: { color: '#B42318' },
});
