'use client';

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NAVIGATION_COUNT_TABLES, readNavigationCounts } from '../../../lib/services/navigation-counts.js';
import { useLiveQuery } from './use-live-query';

export function useNavigationCounts(supabase: SupabaseClient, productId: string) {
  const [counts, setCounts] = useState<Awaited<ReturnType<typeof readNavigationCounts>> | null>(null);
  const { error, refresh } = useLiveQuery({
    supabase, productId, enabled: Boolean(productId), tables: NAVIGATION_COUNT_TABLES,
    async load(signal) {
      const next = await readNavigationCounts(supabase, productId, signal);
      return () => setCounts(next);
    },
  });
  return { counts, error, refresh };
}
