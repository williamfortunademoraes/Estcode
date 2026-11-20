import { useLocalSearchParams } from 'expo-router';
import { ProductFormScreen } from '@/src/features/products/ProductFormScreen';

export default function NewProductRoute() {
  const { barcode } = useLocalSearchParams<{ barcode?: string }>();
  return <ProductFormScreen initialBarcode={barcode ?? null} />;
}
