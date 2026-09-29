'use client';
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TrackerSchema } from './use-tracker-actions';
import { requestQaClickUp } from '../services/qa-clickup';
import { readProductRows } from '../../../lib/services/product-rows.js';

export function usePlanFieldSchema(db: SupabaseClient, productId: string, listId: string) {
  const scope = `${productId}:${listId}`;
  const [loaded, setLoaded] = useState<{ scope: string; schema: TrackerSchema; taxonomy: { angles: string[]; personas: string[] } } | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoaded(null); setError('');
    if (!productId || !listId) return;
    async function load() {
      const [schema, angles, personas] = await Promise.all([
        requestQaClickUp(db, productId, { operation: 'creative-schema' }, controller.signal),
        readProductRows(db, 'angles', productId, controller.signal),
        readProductRows(db, 'personas', productId, controller.signal),
      ]);
      if (!controller.signal.aborted) setLoaded({ scope, schema, taxonomy: {
        angles: angles.map(row => String(row.name)), personas: personas.map(row => String(row.name)),
      } });
    }
    void load().catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load ClickUp fields.'); });
    return () => controller.abort();
  }, [db, productId, listId, scope, attempt]);
  return { schema: loaded?.scope === scope ? loaded.schema : null, taxonomy: loaded?.scope === scope ? loaded.taxonomy : { angles: [], personas: [] },
    error, loading: Boolean(listId && !loaded && !error), reload: () => setAttempt(value => value + 1) };
}
