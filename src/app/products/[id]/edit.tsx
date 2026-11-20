import { useLocalSearchParams } from 'expo-router';

import { ProductFormScreen } from '@/src/features/products/ProductFormScreen';

export default function EditProductRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProductFormScreen productId={id} />;
}
