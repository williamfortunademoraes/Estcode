import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { Button, HelperText, Menu, SegmentedButtons, Snackbar, Surface, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/src/components/AppScreen';
import { canRegisterAdjustment, canRegisterStock } from '@/src/features/auth/permissions';
import { adjustmentSchema, entrySchema, exitSchema } from '@/src/features/inventory/inventory-schema';
import { createIdempotencyKey, getInventoryErrorMessage, isRetryableInventoryError, registerAdjustment, registerEntry, registerExit } from '@/src/features/inventory/inventory-service';
import { enqueuePendingOperation, listPendingOperations } from '@/src/features/offline/pending-operations';
import { useInventory } from '@/src/features/inventory/use-inventory';
import { listVisibleProfiles } from '@/src/features/users/user-service';
import { useAuthStore } from '@/src/store/auth-store';
import type { MovementType, Profile } from '@/src/types/domain';

type OperationMode = 'entry' | 'exit' | 'adjustment';
type HistoryFilter = 'all' | MovementType;
interface OperationFormValues { productId: string; quantity: string; countedQuantity: string; reason: string; notes: string; }

const movementLabels: Record<MovementType, string> = { entry: 'Entrada', exit: 'Saída', adjustment: 'Ajuste' };

export default function InventoryScreen() {
  const role = useAuthStore((state) => state.profile?.role ?? null);
  const { inventoryId, products, balances, settings, history, isLoading, isHistoryLoading, error, refresh, loadHistory } = useInventory();
  const [mode, setMode] = useState<OperationMode>('entry');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [productMenuOpen, setProductMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [historyFiltersOpen, setHistoryFiltersOpen] = useState(false);
  const [historyProductId, setHistoryProductId] = useState<string | undefined>();
  const [historyUserId, setHistoryUserId] = useState<string | undefined>();
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);
  const [historyFilterError, setHistoryFilterError] = useState<string | null>(null);
  const [productFilterMenuOpen, setProductFilterMenuOpen] = useState(false);
  const [userFilterMenuOpen, setUserFilterMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { control, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<OperationFormValues>({
    defaultValues: { productId: '', quantity: '', countedQuantity: '', reason: '', notes: '' },
  });
  const selectedProductId = useWatch({ control, name: 'productId' });
  const selectedProduct = products.find((product) => product.id === selectedProductId);
  const selectedBalance = balances.find((balance) => balance.product_id === selectedProductId)?.quantity ?? 0;
  const canMove = canRegisterStock(role);
  const canAdjust = canRegisterAdjustment(role, settings?.allow_operator_adjustments ?? false);

  useEffect(() => {
    const filter = historyFilter === 'all' ? undefined : historyFilter;
    void loadHistory({ movementType: filter });
  }, [historyFilter, loadHistory]);

  useEffect(() => {
    void listVisibleProfiles().then(setUsers).catch(() => setHistoryFilterError('Não foi possível carregar o filtro de usuário.'));
  }, []);

  const refreshPendingCount = () => {
    if (Platform.OS === 'web') return;
    try {
      setPendingCount(listPendingOperations().filter((item) => item.status === 'pending').length);
    } catch {
      setPendingCount(0);
    }
  };

  // The queue is a native SQLite boundary; hydrate its persisted count after mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshPendingCount();
  }, []);

  const selectedHistoryProduct = products.find((product) => product.id === historyProductId);
  const selectedHistoryUser = users.find((user) => user.id === historyUserId);

  const applyHistoryFilters = () => {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if ((historyFrom && !datePattern.test(historyFrom)) || (historyTo && !datePattern.test(historyTo))) {
      setHistoryFilterError('Use datas no formato AAAA-MM-DD.');
      return;
    }
    setHistoryFilterError(null);
    void loadHistory({
      movementType: historyFilter === 'all' ? undefined : historyFilter,
      productId: historyProductId,
      userId: historyUserId,
      from: historyFrom ? `${historyFrom}T00:00:00.000Z` : undefined,
      to: historyTo ? `${historyTo}T23:59:59.999Z` : undefined,
    });
  };

  const clearHistoryFilters = () => {
    setHistoryProductId(undefined);
    setHistoryUserId(undefined);
    setHistoryFrom('');
    setHistoryTo('');
    setHistoryFilterError(null);
    void loadHistory({ movementType: historyFilter === 'all' ? undefined : historyFilter });
  };

  const modeTitle = useMemo(() => movementLabels[mode], [mode]);

  const executeOperation = async (values: OperationFormValues) => {
    if (!inventoryId || !values.productId) return;
    const idempotencyKey = createIdempotencyKey();
    let pendingOperation: { operation_type: 'entry' | 'exit' | 'adjustment'; idempotency_key: string; payload: string; created_at: string } | null = null;
    try {
      const base = { inventory_id: inventoryId, product_id: values.productId, reason: values.reason, notes: values.notes.trim() || null };
      if (mode === 'entry') {
        const input = entrySchema.parse({ ...base, quantity: Number(values.quantity.replace(',', '.')), idempotency_key: idempotencyKey });
        pendingOperation = { operation_type: 'entry', idempotency_key: idempotencyKey, payload: JSON.stringify(input), created_at: new Date().toISOString() };
        await registerEntry(input);
      } else if (mode === 'exit') {
        const input = exitSchema.parse({ ...base, quantity: Number(values.quantity.replace(',', '.')), idempotency_key: idempotencyKey });
        pendingOperation = { operation_type: 'exit', idempotency_key: idempotencyKey, payload: JSON.stringify(input), created_at: new Date().toISOString() };
        await registerExit(input);
      } else {
        const input = adjustmentSchema.parse({ ...base, counted_quantity: Number(values.countedQuantity.replace(',', '.')), idempotency_key: idempotencyKey });
        pendingOperation = { operation_type: 'adjustment', idempotency_key: idempotencyKey, payload: JSON.stringify(input), created_at: new Date().toISOString() };
        await registerAdjustment(input);
      }
      setFeedback(`${modeTitle} confirmada pelo servidor.`);
      reset({ ...values, quantity: '', countedQuantity: '', reason: '', notes: '' });
      await refresh();
    } catch (operationError) {
      if (pendingOperation && Platform.OS !== 'web' && isRetryableInventoryError(operationError)) {
        try {
          enqueuePendingOperation(pendingOperation);
          refreshPendingCount();
          setFeedback('Sem conexão: operação salva como pendente e ainda não efetivada.');
          return;
        } catch {
          setFeedback('Não foi possível confirmar nem salvar a operação pendente.');
          return;
        }
      }
      setFeedback(getInventoryErrorMessage(operationError));
    }
  };

  const confirmOperation = (values: OperationFormValues) => {
    Alert.alert(`Confirmar ${modeTitle.toLowerCase()}`, 'A operação será registrada no histórico e não poderá ser editada.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: () => { void executeOperation(values); } },
    ]);
  };

  const selectMode = (nextMode: OperationMode) => {
    setMode(nextMode);
    setFeedback(null);
  };

  return (
    <AppScreen>
      <Text variant="headlineSmall" style={styles.title}>Estoque compartilhado</Text>
      <Text style={styles.muted}>Movimentações só aparecem como efetivadas após confirmação da RPC.</Text>
      {pendingCount > 0 ? <Surface style={styles.pendingCard} elevation={0}><Text variant="titleMedium">{pendingCount} operação(ões) pendente(s)</Text><Text style={styles.muted}>Foram salvas localmente após falha de conexão e ainda não alteraram o saldo confirmado.</Text></Surface> : null}
      {error ? <HelperText type="error" visible>{error}</HelperText> : null}
      {isLoading ? <Text style={styles.muted}>Carregando saldo…</Text> : null}
      {!isLoading && products.length === 0 ? <Surface style={styles.messageCard} elevation={0}><Text variant="titleMedium">Nenhum produto ativo</Text><Text style={styles.muted}>Cadastre um produto antes de movimentar o estoque.</Text></Surface> : null}

      <Surface style={styles.operationCard} elevation={1}>
        <Text variant="titleMedium" style={styles.cardTitle}>Nova movimentação</Text>
        <SegmentedButtons value={mode} onValueChange={(value) => selectMode(value as OperationMode)} buttons={[
          { value: 'entry', label: 'Entrada', disabled: !canMove },
          { value: 'exit', label: 'Saída', disabled: !canMove },
          { value: 'adjustment', label: 'Ajuste', disabled: !canAdjust },
        ]} />
        <Menu visible={productMenuOpen} onDismiss={() => setProductMenuOpen(false)} anchor={<Button mode="outlined" onPress={() => setProductMenuOpen(true)} disabled={!products.length}>{selectedProduct?.name ?? 'Selecionar produto'}</Button>}>
          {products.map((product) => <Menu.Item key={product.id} title={`${product.name}${product.sku ? ` · ${product.sku}` : ''}`} onPress={() => { setValue('productId', product.id); setProductMenuOpen(false); }} />)}
        </Menu>
        {selectedProduct ? <Text style={styles.balance}>Saldo atual: <Text style={styles.balanceValue}>{selectedBalance} {selectedProduct.unit}</Text></Text> : null}
        {mode === 'adjustment' ? (
          <Controller control={control} name="countedQuantity" render={({ field: { onChange, value } }) => <TextInput label="Quantidade contada *" value={value} onChangeText={onChange} keyboardType="decimal-pad" error={Boolean(errors.countedQuantity)} />} />
        ) : (
          <Controller control={control} name="quantity" render={({ field: { onChange, value } }) => <TextInput label="Quantidade *" value={value} onChangeText={onChange} keyboardType="decimal-pad" error={Boolean(errors.quantity)} />} />
        )}
        <Controller control={control} name="reason" render={({ field: { onChange, value } }) => <TextInput label="Motivo *" value={value} onChangeText={onChange} error={Boolean(errors.reason)} />} />
        <Controller control={control} name="notes" render={({ field: { onChange, value } }) => <TextInput label="Observação (opcional)" value={value} onChangeText={onChange} multiline />} />
        {!canMove ? <HelperText type="info" visible>Seu perfil pode consultar, mas não registrar movimentações.</HelperText> : null}
        {mode === 'adjustment' && !canAdjust ? <HelperText type="info" visible>Ajustes de operadores precisam ser habilitados pelo administrador.</HelperText> : null}
        <Button mode="contained" onPress={() => { void handleSubmit(confirmOperation)(); }} loading={isSubmitting} disabled={!inventoryId || !selectedProduct || !canMove || (mode === 'adjustment' && !canAdjust) || isSubmitting} contentStyle={styles.buttonContent}>
          Confirmar {modeTitle.toLowerCase()}
        </Button>
      </Surface>

      <Surface style={styles.historyCard} elevation={0}>
        <View style={styles.historyHeader}><Text variant="titleMedium" style={styles.cardTitle}>Histórico</Text><Button compact onPress={() => void refresh()}>Atualizar</Button></View>
        <SegmentedButtons value={historyFilter} onValueChange={(value) => setHistoryFilter(value as HistoryFilter)} buttons={[{ value: 'all', label: 'Todos' }, { value: 'entry', label: 'Entradas' }, { value: 'exit', label: 'Saídas' }, { value: 'adjustment', label: 'Ajustes' }]} />
        <Button mode="text" onPress={() => setHistoryFiltersOpen((value) => !value)}>{historyFiltersOpen ? 'Ocultar filtros avançados' : 'Filtrar por produto, usuário e período'}</Button>
        {historyFiltersOpen ? <View style={styles.advancedFilters}>
          <Menu visible={productFilterMenuOpen} onDismiss={() => setProductFilterMenuOpen(false)} anchor={<Button mode="outlined" onPress={() => setProductFilterMenuOpen(true)}>{selectedHistoryProduct?.name ?? 'Todos os produtos'}</Button>}>
            <Menu.Item title="Todos os produtos" onPress={() => { setHistoryProductId(undefined); setProductFilterMenuOpen(false); }} />
            {products.map((product) => <Menu.Item key={product.id} title={product.name} onPress={() => { setHistoryProductId(product.id); setProductFilterMenuOpen(false); }} />)}
          </Menu>
          <Menu visible={userFilterMenuOpen} onDismiss={() => setUserFilterMenuOpen(false)} anchor={<Button mode="outlined" onPress={() => setUserFilterMenuOpen(true)}>{selectedHistoryUser?.full_name || 'Todos os usuários'}</Button>}>
            <Menu.Item title="Todos os usuários" onPress={() => { setHistoryUserId(undefined); setUserFilterMenuOpen(false); }} />
            {users.map((user) => <Menu.Item key={user.id} title={user.full_name || user.id} onPress={() => { setHistoryUserId(user.id); setUserFilterMenuOpen(false); }} />)}
          </Menu>
          <TextInput label="De (AAAA-MM-DD)" value={historyFrom} onChangeText={setHistoryFrom} autoCapitalize="none" />
          <TextInput label="Até (AAAA-MM-DD)" value={historyTo} onChangeText={setHistoryTo} autoCapitalize="none" />
          {historyFilterError ? <HelperText type="error" visible>{historyFilterError}</HelperText> : null}
          <View style={styles.filterActions}><Button mode="contained" onPress={applyHistoryFilters}>Aplicar filtros</Button><Button onPress={clearHistoryFilters}>Limpar</Button></View>
        </View> : null}
        {isHistoryLoading ? <Text style={styles.muted}>Carregando histórico…</Text> : null}
        {!isHistoryLoading && history.length === 0 ? <Text style={styles.muted}>Nenhuma movimentação encontrada.</Text> : null}
        {history.slice(0, 30).map((movement) => <View key={movement.id} style={styles.historyRow}><View style={styles.historyMain}><Text variant="titleSmall">{movement.product_name}</Text><Text variant="bodySmall" style={styles.muted}>{movementLabels[movement.movement_type]} · {movement.reason}</Text><Text variant="bodySmall" style={styles.muted}>{movement.user_name} · {new Date(movement.created_at).toLocaleString('pt-BR')}</Text><Text variant="bodySmall" style={styles.muted}>Saldo: {movement.previous_balance} → {movement.resulting_balance}{movement.notes ? ` · ${movement.notes}` : ''}</Text></View><Text variant="titleMedium" style={movement.movement_type === 'exit' ? styles.exit : styles.entry}>{movement.movement_type === 'exit' ? '-' : movement.movement_type === 'adjustment' ? movement.quantity >= 0 ? '+' : '' : '+'}{movement.movement_type === 'adjustment' ? movement.quantity : Math.abs(movement.quantity)}</Text></View>)}
      </Surface>
      <Snackbar visible={Boolean(feedback)} onDismiss={() => setFeedback(null)} duration={4500}>{feedback}</Snackbar>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 16, fontWeight: '700' },
  muted: { marginTop: 6, color: '#667085', lineHeight: 20 },
  operationCard: { gap: 12, marginTop: 18, padding: 18, borderRadius: 18, backgroundColor: '#FFFFFF' },
  cardTitle: { fontWeight: '700' },
  messageCard: { marginTop: 18, padding: 18, borderRadius: 16, backgroundColor: '#EEF2F6' },
  pendingCard: { marginTop: 18, padding: 16, borderRadius: 16, backgroundColor: '#FFF4E5' },
  balance: { color: '#475467' },
  balanceValue: { fontWeight: '700', color: '#155EEF' },
  buttonContent: { minHeight: 48 },
  historyCard: { gap: 12, marginTop: 18, padding: 18, borderRadius: 18, backgroundColor: '#EEF2F6' },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D0D5DD' },
  historyMain: { flex: 1 },
  advancedFilters: { gap: 10, padding: 12, borderRadius: 12, backgroundColor: '#F8FAFC' },
  filterActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entry: { color: '#039855' },
  exit: { color: '#D92D20' },
});
