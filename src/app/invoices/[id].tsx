import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Surface, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/src/components/AppScreen';
import { canManageUsers } from '@/src/features/auth/permissions';
import { applyFiscalDocument, findFiscalItemProducts, getFiscalDocumentItems, listFiscalDocuments, mapFiscalItem, type FiscalDocument, type FiscalItem } from '@/src/features/invoices/invoice-service';
import { useAuthStore } from '@/src/store/auth-store';
import type { Product } from '@/src/types/domain';

export default function FiscalDocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isAdmin = canManageUsers(useAuthStore((state) => state.profile?.role ?? null));
  const [document, setDocument] = useState<FiscalDocument | null>(null);
  const [items, setItems] = useState<FiscalItem[]>([]);
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    try {
      const [all, lines] = await Promise.all([listFiscalDocuments(), getFiscalDocumentItems(id)]);
      setDocument(all.find((row) => row.id === id) ?? null); setItems(lines);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a nota.'); }
  }, [id]);
  useEffect(() => { const timer = setTimeout(() => { void reload(); }, 0); return () => clearTimeout(timer); }, [reload]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim()) void findFiscalItemProducts(search).then(setProducts).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Falha na busca.'));
      else setProducts([]);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const associate = async (itemId: string, productId: string) => {
    setBusy(true); setError(null);
    try { await mapFiscalItem(itemId, productId); await reload(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao associar o produto.'); }
    finally { setBusy(false); }
  };
  const apply = async () => {
    setBusy(true); setError(null);
    try { await applyFiscalDocument(id); await reload(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao aplicar a nota.'); }
    finally { setBusy(false); }
  };

  return <AppScreen><ScrollView contentContainerStyle={styles.content}>
    <Text variant="headlineSmall" style={styles.title}>Conferir nota fiscal</Text>
    {document ? <Surface style={styles.card} elevation={1}>
      <Text variant="titleMedium">{document.issuer_name ?? 'Emitente'}</Text>
      <Text style={styles.muted}>{document.document_type === 'full' ? 'NF-e completa' : 'Resumo fiscal'}</Text>
      <Text style={styles.muted}>Chave: {document.access_key ?? 'indisponível'}</Text>
      <Text>Total: {document.total_amount == null ? 'indisponível' : `R$ ${document.total_amount.toFixed(2).replace('.', ',')}`}</Text>
      <Text style={styles.status}>Status: {document.fiscal_status}</Text>
    </Surface> : null}
    {error ? <HelperText type="error" visible>{error}</HelperText> : null}
    {items.map((item) => <Surface key={item.id} style={styles.card} elevation={1}>
      <Text variant="titleSmall">{item.line_number}. {item.description}</Text>
      <Text style={styles.muted}>{item.quantity} {item.unit ?? ''} · R$ {item.unit_price.toFixed(2).replace('.', ',')} / unidade</Text>
      <Text style={styles.muted}>Código do fornecedor: {item.supplier_code ?? '—'} · EAN: {item.barcode ?? '—'}</Text>
      {item.product_id ? <Text style={styles.mapped}>Produto associado</Text> : null}
      {isAdmin && document?.fiscal_status !== 'applied' ? <>
        <TextInput label="Pesquisar produto por nome, SKU ou código de barras" value={search} onChangeText={setSearch} mode="outlined" />
        {products.map((product) => <Button key={product.id} mode="text" disabled={busy} onPress={() => { void associate(item.id, product.id); }}>{product.name} · {product.sku ?? product.barcode ?? 'sem código'} · {product.unit}</Button>)}
      </> : null}
    </Surface>)}
    {isAdmin && document?.fiscal_status === 'ready_for_review' ? <Button mode="contained" loading={busy} disabled={busy || items.length === 0 || items.some((item) => !item.product_id)} onPress={() => { void apply(); }}>Confirmar entrada no estoque</Button> : null}
    <View><Text style={styles.muted}>O estoque só será atualizado após associação de todos os itens e confirmação do administrador. Itens com unidade diferente do cadastro serão recusados.</Text></View>
  </ScrollView></AppScreen>;
}

const styles = StyleSheet.create({ content: { gap: 12, paddingBottom: 28 }, title: { marginTop: 16, fontWeight: '700' }, card: { gap: 8, padding: 16, borderRadius: 14, backgroundColor: '#FFFFFF' }, muted: { color: '#667085', lineHeight: 20 }, status: { color: '#175CD3', fontWeight: '600' }, mapped: { color: '#067647', fontWeight: '600' } });
