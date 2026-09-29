'use client';
import { useMemo, useRef, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readPlanVisibility, savePlanVisibility } from '../../../lib/services/action-plan-visibility.js';
import { useLiveQuery } from './use-live-query';

export function usePlanVisibility(db: SupabaseClient, productId: string) {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const live = useLiveQuery({ supabase: db, productId: '', tables: ['profiles'],
    load: async (signal) => {
      const next = await readPlanVisibility(db, signal);
      return () => { setIds(next); setReady(true); };
    }, onMutationError: setError, onMutationEnd: () => setSaving(false) });
  const hiddenIds = useMemo(() => new Set(ids), [ids]);
  const change = live.mutate(async (adId: string, hidden: boolean) => {
    if (!ready) throw new Error('Wait for hidden-task preferences to load.');
    setError(''); setSaving(true);
    const next = await savePlanVisibility(db, productId, adId, hidden);
    if (mounted.current) setIds(next);
  });
  return { hiddenIds, ready, busy: saving || live.busy, error: error || live.error, change,
    reload: () => { setError(''); void live.refresh(); } };
}

export type PlanVisibility = ReturnType<typeof usePlanVisibility>;
