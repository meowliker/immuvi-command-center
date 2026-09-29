'use client';
import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readSavedPlanCount } from '../../../lib/services/action-plan-count.js';
import { useLiveQuery } from './use-live-query';

export function usePlanCount(supabase: SupabaseClient, productId: string) {
  const [count, setCount] = useState<number | null>(null);
  const { error, refresh } = useLiveQuery({
    supabase, productId, enabled: Boolean(productId),
    tables: ['manual_actions', 'ads', 'deleted_ads'],
    async load(signal) {
      const next = await readSavedPlanCount(supabase, productId, signal);
      return () => setCount(next);
    },
  });
  return { count, error, refresh };
}
