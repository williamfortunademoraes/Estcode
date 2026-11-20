import { useLocalSearchParams } from 'expo-router';

import { ProductDetailsScreen } from '@/src/features/products/ProductDetailsScreen';

export default function ProductDetailsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProductDetailsScreen productId={id} />;
}
