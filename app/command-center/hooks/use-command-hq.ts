'use client';

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { commandHqSnapshot } from '../../../lib/domain/command-hq.js';
import { readProductRows } from '../../../lib/services/product-rows.js';
import { useLiveQuery } from './use-live-query';

export function useCommandHq(supabase: SupabaseClient, productId: string) {
  const [data, setData] = useState<ReturnType<typeof commandHqSnapshot> | null>(null);
  const [loadedAt, setLoadedAt] = useState('');
  const live = useLiveQuery({
    supabase, productId, tables: ['ads', 'angles', 'personas', 'deleted_ads', 'products'], enabled: Boolean(productId),
    load: async (signal) => {
      const [ads, angles, personas, tombstones] = await Promise.all(
        ['ads', 'angles', 'personas', 'deleted_ads'].map((table) => readProductRows(supabase, table, productId, signal)),
      );
      const product = await supabase.from('products').select('config').eq('id', productId).abortSignal(signal).single();
      if (product.error || !product.data) throw new Error('Product field catalog could not be loaded.');
      const snapshot = commandHqSnapshot({ productId, ads, angles, personas, tombstones, fieldOptions: product.data.config?.field_options });
      return () => { setData(snapshot); setLoadedAt(new Date().toISOString()); };
    },
  });
  return { data, loadedAt, busy: live.busy, error: live.error, refresh: live.refresh };
}
