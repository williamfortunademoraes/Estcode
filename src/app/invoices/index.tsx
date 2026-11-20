import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Surface, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/src/components/AppScreen';
import { canManageUsers } from '@/src/features/auth/permissions';
import { getFiscalCompanyCnpj, listFiscalDocuments, saveFiscalCompanyCnpj, synchronizeFiscalDocuments, type FiscalDocument } from '@/src/features/invoices/invoice-service';
import { useAuthStore } from '@/src/store/auth-store';

const statusLabels: Record<string, string> = {
  awaiting_manifestation: 'Aguardando manifestação fiscal', ready_for_review: 'Pronta para conferência',
  applied: 'Entrada aplicada', canceled: 'Cancelada', ignored: 'Ignorada', awaiting_review: 'Aguardando conferência',
};

export default function InvoicesScreen() {
  const role = useAuthStore((state) => state.profile?.role ?? null);
  const isAdmin = canManageUsers(role);
  const autoSyncStarted = useRef(false);
  const [cnpj, setCnpj] = useState('');
  const [documents, setDocuments] = useState<FiscalDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const [rows, companyCnpj] = await Promise.all([listFiscalDocuments(), isAdmin ? getFiscalCompanyCnpj() : Promise.resolve('')]);
      setDocuments(rows); if (isAdmin) setCnpj(companyCnpj);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao carregar notas fiscais.'); }
    finally { setBusy(false); }
  }, [isAdmin]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh().then(async () => {
        if (!isAdmin || autoSyncStarted.current) return;
        autoSyncStarted.current = true;
        setBusy(true); setError(null);
        try {
          if (!(await getFiscalCompanyCnpj())) {
            setMessage('Cadastre o CNPJ da empresa para ativar a consulta automática ao abrir esta tela.');
            return;
          }
          const result = await synchronizeFiscalDocuments();
          setMessage(result.receivedDocuments ? `${result.receivedDocuments} documento(s) novo(s) recebido(s).` : 'Consulta automática concluída; sem novos documentos.');
          await refresh();
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'A consulta fiscal falhou.'); }
        finally { setBusy(false); }
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [isAdmin, refresh]);

  const saveCompany = async () => {
    setBusy(true); setError(null); setMessage(null);
    try { await saveFiscalCompanyCnpj(cnpj); setMessage('CNPJ fiscal salvo.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  };

  const synchronize = async () => {
    setBusy(true); setError(null); setMessage(null);
    try {
      const result = await synchronizeFiscalDocuments();
      setMessage(result.receivedDocuments ? `${result.receivedDocuments} documento(s) recebido(s).` : 'Consulta concluída; nenhum documento novo foi disponibilizado.');
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'A consulta fiscal falhou.'); }
    finally { setBusy(false); }
  };

  return <AppScreen>
    <ScrollView refreshControl={<RefreshControl refreshing={busy} onRefresh={() => { void refresh(); }} />} contentContainerStyle={styles.content}>
      <Text variant="headlineSmall" style={styles.title}>Notas fiscais de entrada</Text>
      <Text style={styles.muted}>Consulta documentos disponibilizados pela SEFAZ para o CNPJ da empresa. Nenhum saldo é alterado durante a importação.</Text>
      {isAdmin ? <Surface style={styles.card} elevation={1}>
        <Text variant="titleMedium">Empresa destinatária</Text>
        <TextInput label="CNPJ" value={cnpj} onChangeText={setCnpj} keyboardType="number-pad" maxLength={18} mode="outlined" />
        <Button mode="outlined" onPress={() => { void saveCompany(); }} disabled={busy}>Salvar CNPJ</Button>
        <Button mode="contained" onPress={() => { void synchronize(); }} loading={busy} disabled={busy}>Consultar notas na SEFAZ</Button>
        <Text style={styles.muted}>A consulta usa certificado A1 instalado no serviço fiscal. A SEFAZ limita consultas sucessivas e pode exigir manifestação para liberar o XML completo.</Text>
      </Surface> : null}
      {error ? <HelperText type="error" visible>{error}</HelperText> : null}
      {message ? <HelperText type="info" visible>{message}</HelperText> : null}
      <View style={styles.listHeader}><Text variant="titleMedium">Documentos recebidos</Text><Button compact onPress={() => { void refresh(); }}>Atualizar</Button></View>
      {!documents.length && !busy ? <Surface style={styles.empty} elevation={0}><Text variant="titleSmall">Nenhum documento importado</Text><Text style={styles.muted}>Quando a SEFAZ disponibilizar documentos para o CNPJ, eles aparecerão aqui para conferência.</Text></Surface> : null}
      {documents.map((document) => <Link key={document.id} href={{ pathname: '/invoices/[id]', params: { id: document.id } }} asChild><Pressable><DocumentCard document={document} /></Pressable></Link>)}
    </ScrollView>
  </AppScreen>;
}

function DocumentCard({ document }: { document: FiscalDocument }) {
  return <Surface style={styles.card} elevation={1}>
    <Text variant="titleSmall">{document.issuer_name || 'Emitente não identificado'}</Text>
    <Text style={styles.muted}>{document.document_type === 'full' ? 'NF-e completa' : document.document_type === 'summary' ? 'Resumo de NF-e' : 'Documento fiscal'}</Text>
    {document.access_key ? <Text selectable style={styles.muted}>Chave: {document.access_key}</Text> : null}
    <View style={styles.row}><Text>{document.total_amount != null ? `R$ ${document.total_amount.toFixed(2).replace('.', ',')}` : 'Valor indisponível'}</Text><Text style={styles.status}>{statusLabels[document.fiscal_status] ?? document.fiscal_status}</Text></View>
    <Text style={styles.date}>{document.issued_at ? new Date(document.issued_at).toLocaleDateString('pt-BR') : `Recebida ${new Date(document.received_at).toLocaleDateString('pt-BR')}`}</Text>
  </Surface>;
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 28 }, title: { marginTop: 16, fontWeight: '700' },
  muted: { color: '#667085', lineHeight: 21 }, card: { gap: 10, padding: 16, borderRadius: 14, backgroundColor: '#FFFFFF' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  empty: { gap: 6, padding: 18, borderRadius: 14, backgroundColor: '#F2F4F7' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, status: { color: '#175CD3', fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  date: { color: '#98A2B3', fontSize: 12 },
});
