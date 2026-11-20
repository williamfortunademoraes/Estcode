import { useCallback, useEffect, useState } from 'react';

import { listProducts } from './product-service';
import type { Product } from '@/src/types/domain';

export function useProducts(search: string, categoryId?: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      setIsLoading(true);
      void listProducts({ search, categoryId })
        .then((result) => {
          if (mounted) {
            setProducts(result);
            setError(null);
          }
        })
        .catch(() => {
          if (mounted) setError('Não foi possível carregar os produtos.');
        })
        .finally(() => {
          if (mounted) setIsLoading(false);
        });
    }, 250);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [categoryId, reloadToken, search]);

  return { products, isLoading, error, reload };
}
