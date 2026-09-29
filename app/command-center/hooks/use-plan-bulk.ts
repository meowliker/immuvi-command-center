'use client';

import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActionRecord } from '../types';
import { savePlanBatch, runPlanPush } from '../../../lib/services/action-plan-bulk.js';
import { requestQaClickUp } from '../services/qa-clickup';
import { pushPlanCreative } from '../services/plan-workflow';
import { matchingClickUpStatus } from '../../../lib/domain/clickup-statuses.js';

export type PlanBulkResult = { id: string; title: string; state: string; message: string };
export type PlanBulkOperation = 'status' | 'due' | 'remove' | 'push';

export function usePlanBulk(db: SupabaseClient, productId: string) {
  const [selection, setSelection] = useState({ ids: [] as string[], only: false });
  const [results, setResults] = useState<PlanBulkResult[]>([]);
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const stop = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; stop.current = true; }; }, []);

  function select(ids: string[], checked: boolean) {
    setSelection((current) => ({ ...current, ids: checked ? [...new Set([...current.ids, ...ids])] : current.ids.filter((id) => !ids.includes(id)) }));
  }
  function replaceId(previous: string, next: string) {
    setSelection((current) => ({ ...current, ids: [...new Set(current.ids.map((id) => id === previous ? next : id))] }));
  }
  function replaceIds(replacements: Map<string, string>) {
    if (replacements.size) setSelection((current) => ({ ...current, ids: [...new Set(current.ids.map((id) => replacements.get(id) || id))] }));
  }

  async function run(actions: ActionRecord[], operation: PlanBulkOperation, value?: string) {
    if (operation === 'remove' && !window.confirm(`Remove ${actions.length} selected visible task(s) from Action Plan?\n\nTheir creatives and ClickUp tasks will not be deleted.`)) return;
    stop.current = false; setStopping(false); setRunning(true); setResults([]);
    try {
      if (operation === 'status' && actions.some(action => action.display.clickupTaskId)) {
        const schema = await requestQaClickUp(db, productId, { operation: 'plan-statuses' });
        matchingClickUpStatus(value, schema.statuses);
      }
      if (operation !== 'push') {
        await savePlanBatch(db, productId, actions, operation, value ?? null);
        if (mounted.current) setResults(actions.map((a) => ({ id: a.display.dbId, title: a.display.title, state: 'saved', message: operation === 'remove' ? 'Removed from plan; creative and ClickUp task preserved.' : 'Saved in QA.' })));
      }
      function displayResults(next: PlanBulkResult[]) {
        return next.map((result) => {
          if (operation === 'push' || !['failed', 'skipped'].includes(result.state)) return result;
          if (!actions.find((action) => action.display.dbId === result.id)?.display.clickupTaskId) return { ...result, state: 'saved', message: 'Saved in QA.' };
          return { ...result, state: 'pending', message: `Saved in QA. ClickUp pending: ${result.message}` };
        });
      }
      const final = operation === 'remove' ? [] : await runPlanPush(actions, async (action: ActionRecord) => {
        if (operation !== 'push' && !action.display.clickupTaskId) return { state: 'saved', message: 'Saved in QA.' };
        if (!action.display.linkedAdId) throw new Error('No linked creative. Add a creative before pushing.');
        if ((action.payload.sourceAdId || action.payload.adId || action.payload._sourceAdId) !== action.display.linkedAdId) throw new Error('Source identity is unresolved. Re-link this task before pushing.');
        if (!action.display.clickupTaskId) return { state: 'pushed', message: await pushPlanCreative(db, productId, action.display.linkedAdId, undefined, action.display.dbId) };
        const result = await requestQaClickUp(db, productId, { operation: 'push-creative', adId: action.display.linkedAdId, actionId: action.display.dbId });
        if (result.failed?.length) throw new Error(result.failed.map((f: { field: string; error: string }) => `${f.field}: ${f.error}`).join('; '));
        return { state: 'pushed', message: result.pushed ? 'Pending fields sent to ClickUp.' : 'No pending ClickUp fields.' };
      }, {
        shouldStop: () => stop.current,
        onProgress: (next: PlanBulkResult[]) => {
          if (mounted.current) setResults(displayResults(next));
        },
      });
      if (mounted.current) {
        const completed = operation === 'remove' ? actions.map((a) => a.display.dbId) : displayResults(final).filter((r) => ['saved', 'pushed'].includes(r.state)).map((r) => r.id);
        setSelection((current) => {
          const ids = current.ids.filter((id) => !completed.includes(id));
          return { ids, only: current.only && ids.length > 0 };
        });
      }
    } finally { if (mounted.current) setRunning(false); }
  }

  return { selectedIds: selection.ids, selectedOnly: selection.only,
    setSelectedOnly: (only: boolean) => setSelection((current) => ({ ...current, only })),
    select, replaceId, replaceIds, clear: () => setSelection({ ids: [], only: false }), results, running, stopping, run,
    cancel: () => { stop.current = true; setStopping(true); } };
}
