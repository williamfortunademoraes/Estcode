import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Button, HelperText, Snackbar, Surface, Text } from 'react-native-paper';

import { AppScreen } from '@/src/components/AppScreen';
import { isSupportedBarcode, shouldProcessBarcode } from '@/src/features/barcode/barcode-rules';
import { getProductByBarcode } from '@/src/features/products/product-service';

const SCAN_COOLDOWN_MS = 1800;

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [lastValue, setLastValue] = useState<string | null>(null);
  const [lastTimestamp, setLastTimestamp] = useState<number | null>(null);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleBarcodeScanned = useCallback(async ({ type, data }: BarcodeScanningResult) => {
    if (!isScanning) return;
    const now = Date.now();
    if (!isSupportedBarcode(type, data) || !shouldProcessBarcode(lastValue, lastTimestamp, data, now, SCAN_COOLDOWN_MS)) return;
    setLastValue(data);
    setLastTimestamp(now);
    setIsScanning(false);
    try {
      const product = await getProductByBarcode(data);
      if (product) {
        router.push({ pathname: '/products/[id]', params: { id: product.id } });
      } else {
        setUnknownBarcode(data);
      }
    } catch {
      setMessage('Não foi possível consultar o código no Supabase.');
      setIsScanning(true);
    }
  }, [isScanning, lastTimestamp, lastValue, router]);

  if (Platform.OS === 'web') {
    return <AppScreen><Surface style={styles.card} elevation={0}><Text variant="titleMedium">Scanner disponível no Android</Text><Text style={styles.muted}>A leitura usa a câmera nativa do dispositivo Android.</Text></Surface></AppScreen>;
  }
  if (!permission) return <AppScreen><Text style={styles.muted}>Verificando permissão da câmera…</Text></AppScreen>;
  if (!permission.granted) {
    return <AppScreen><Surface style={styles.card} elevation={1}><Text variant="titleMedium">Permissão da câmera necessária</Text><Text style={styles.muted}>O ESTCODE usa a câmera somente para identificar códigos EAN-8 e EAN-13.</Text><Button mode="contained" onPress={() => { void requestPermission(); }} contentStyle={styles.buttonContent}>Permitir câmera</Button></Surface></AppScreen>;
  }

  return (
    <AppScreen>
      <Text variant="headlineSmall" style={styles.title}>Scanner</Text>
      <Text style={styles.muted}>Centralize o código na moldura para consultar o produto.</Text>
      <Surface style={styles.cameraCard} elevation={1}>
        <View style={styles.cameraFrame}>
          <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['ean8', 'ean13'] }} onBarcodeScanned={isScanning ? handleBarcodeScanned : undefined} />
          <View pointerEvents="none" style={styles.scanOverlay}><View style={styles.scanBox} /></View>
        </View>
        {!isScanning ? <Button mode="outlined" onPress={() => { setUnknownBarcode(null); setIsScanning(true); }} contentStyle={styles.buttonContent}>Ler outro código</Button> : null}
      </Surface>
      {unknownBarcode ? <Surface style={styles.card} elevation={0}><Text variant="titleMedium">Produto não encontrado</Text><Text style={styles.muted}>Código lido: {unknownBarcode}</Text><Button mode="contained" onPress={() => router.push({ pathname: '/products/new', params: { barcode: unknownBarcode } })} contentStyle={styles.buttonContent}>Cadastrar produto</Button></Surface> : null}
      <HelperText type="info" visible>O código é consultado somente no banco do ESTCODE; não usamos catálogo externo.</HelperText>
      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage(null)}>{message}</Snackbar>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 16, fontWeight: '700' },
  muted: { marginTop: 8, marginBottom: 16, color: '#667085', lineHeight: 21 },
  cameraCard: { gap: 14, marginTop: 18, padding: 14, borderRadius: 18, backgroundColor: '#FFFFFF' },
  cameraFrame: { height: 330, overflow: 'hidden', borderRadius: 14, backgroundColor: '#101828' },
  scanOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  scanBox: { width: '78%', height: 130, borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 16 },
  card: { marginTop: 18, padding: 18, borderRadius: 16, backgroundColor: '#EEF2F6' },
  buttonContent: { minHeight: 48 },
});
