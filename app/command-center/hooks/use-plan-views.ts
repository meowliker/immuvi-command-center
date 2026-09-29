'use client';
import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePlanViews } from '../../../lib/domain/action-plan-views.js';
import { useLiveQuery } from './use-live-query';

export type PlanViewState = ReturnType<typeof normalizePlanViews>;
export type PlanColumnState = PlanViewState['views'][number]['columns'][number];
export function usePlanViews(db: SupabaseClient) {
  const [state, setState] = useState<PlanViewState>(() => normalizePlanViews(null));
  const [expected, setExpected] = useState<unknown>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [manager, setManager] = useState<{ state: PlanViewState; expected: unknown } | null>(null);
  const live = useLiveQuery({ supabase: db, productId: '', tables: ['profiles'], load,
    onMutationError: setError, onMutationEnd: () => setSaving(false) });
  async function load(signal: AbortSignal) {
    const session = await db.auth.getSession();
    if (session.error || !session.data.session) throw new Error('Sign in to load saved views.');
    const result = await db.from('profiles').select('ap_col_state').eq('id', session.data.session.user.id).abortSignal(signal).single();
    if (result.error) throw new Error('Could not load saved views.');
    const preferences = result.data?.ap_col_state;
    return () => { setExpected(preferences?.qa_next ?? null); setState(normalizePlanViews(preferences?.qa_next || preferences)); setReady(true); };
  }
  async function save(next: PlanViewState, previous: unknown) {
    setSaving(true); setError('');
    const result = await db.rpc('qa_plan_preferences', { p_expected: previous, p_value: normalizePlanViews(next) });
    if (result.error) throw new Error(result.error.message);
    setState(normalizePlanViews(result.data)); setExpected(result.data); setManager(null);
  }
  return { state, manager, ready, busy: saving || live.busy, error: error || live.error,
    open: () => { setError(''); setManager({ state, expected }); }, close: () => setManager(null),
    save: live.mutate(save),
    resizeColumn: live.mutate(async (columns: PlanColumnState[], key: string, width: number) => {
      if (!ready || saving) return;
      await save({ ...state, views: state.views.map((view) => view.id === state.activeViewId
        ? { ...view, columns: columns.map((column) => column.key === key ? { ...column, width } : column) } : view) }, expected);
    }),
    switchView: live.mutate(async (id: string) => { await save({ ...state, activeViewId: id }, expected); }) };
}
