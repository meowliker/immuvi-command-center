'use client';
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requestQaClickUp } from '../services/qa-clickup';

export function usePlanStatuses(db: SupabaseClient, productId: string, listId: string) {
  const [statuses, setStatuses] = useState<{ status: string; orderindex?: number; type?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setStatuses([]); setError(''); setLoading(Boolean(listId));
    if (!listId) return;
    requestQaClickUp(db, productId, { operation: 'plan-statuses' }, controller.signal).then((result) => {
      if (!controller.signal.aborted) setStatuses(Array.isArray(result.statuses) ? result.statuses : []);
    }).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load ClickUp statuses.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [db, productId, listId, attempt]);
  return { statuses, loading, error, reload: () => setAttempt((value) => value + 1) };
}
