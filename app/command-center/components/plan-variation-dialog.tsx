'use client';
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Creative } from '../types';
import type { useActionPlan } from '../hooks/use-action-plan';
import type { TrackerSchema } from '../hooks/use-tracker-actions';
import { normalizeCreativeRow } from '../../../lib/domain/creative-tracker.js';
import { canSpawnVariations } from '../../../lib/domain/variation-lab.js';
import { loadWinningFiles } from '../services/tracker';
import { requestQaClickUp } from '../services/qa-clickup';
import { creationLocked } from '../services/plan-workflow';
import { TrackerDialog } from './tracker-dialog';
import { TrackerSpawn } from './tracker-spawn';

export function PlanVariationDialog({ db, productId, parentId, plan, close, done }: {
  db: SupabaseClient; productId: string; parentId: string; plan: ReturnType<typeof useActionPlan>;
  close: () => void; done: (message: string) => void;
}) {
  const [creative, setCreative] = useState<Creative | null>(null);
  const [schema, setSchema] = useState<TrackerSchema | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [uncertain, setUncertain] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setError(''); setCreative(null);
    async function load() {
      const result = await db.from('ads').select('*').eq('product_id', productId).eq('id', parentId).is('deleted_at', null).abortSignal(controller.signal).single();
      const parent = result.data ? normalizeCreativeRow(result.data) : null;
      if (result.error || !parent || parent.productId !== productId || !canSpawnVariations(parent)) throw new Error('This winning creative is no longer available.');
      const files = await loadWinningFiles(db, [parentId], controller.signal);
      // Keep the opening version for optimistic concurrency; realtime must not replace a draft's baseline.
      if (!controller.signal.aborted) setCreative({ ...parent, winningArtifacts: files[parentId] || [] });
    }
    void load().catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load variation parent.'); });
    return () => controller.abort();
  }, [db, productId, parentId, attempt]);
  const available = canSpawnVariations(plan.ageAds.find((ad) => ad.id === parentId && ad.productId === productId))
    && !creationLocked(plan.creationJobs.find((job) => job.ad_id === parentId));
  async function run(operation: () => Promise<void>) {
    setBusy(true); setError('');
    try { await plan.mutate(async () => { try { await operation(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Request failed.'); } })(); }
    finally { setBusy(false); }
  }
  return <TrackerDialog title={`Variation Lab${creative ? `: ${creative.formatName}` : ''}`} busy={busy} error={error} closeLabel="Close Variation Lab" onClose={close}>
    {!creative ? error ? <button type="button" onClick={() => setAttempt((value) => value + 1)}>Retry parent loading</button> : <p role="status">Loading variation parent...</p> : <>
      {!available ? <p role="alert">The parent is no longer eligible for variations. Close this editor and refresh the plan.</p> : null}
      <TrackerSpawn creative={creative} creatives={[]} variationOnly schema={schema} busy={busy} disabled={!!plan.busyAction || !available || uncertain}
        loadSchema={() => run(async () => { setSchema(await requestQaClickUp(db, productId, { operation: 'creative-schema' })); })}
        spawn={(_, kind, rows, fileId) => run(async () => {
          if (!available) throw new Error('This parent is no longer eligible for variations.');
          // This legacy RPC has no idempotency key. An ambiguous response must not enable a blind repeat.
          setUncertain(true);
          const result = await db.rpc('qa_tracker_spawn', { p_product_id: productId, p_parent_id: creative.id,
            p_expected_updated_at: creative.version, p_kind: kind, p_rows: rows, p_winner_file_id: fileId || null });
          if (result.error) {
            if (/^(P0001|22|23|42501)/.test(result.error.code || '')) setUncertain(false);
            throw new Error(result.error.message);
          }
          const ids = result.data;
          if (!Array.isArray(ids) || ids.length !== rows.length || new Set(ids).size !== ids.length || ids.some((id) => typeof id !== 'string' || !id)) throw new Error('Creation response could not be verified.');
          done(`${ids.length} variations created and assigned to the parent matrix cell.`);
        })} />
      {uncertain && !busy ? <p role="alert">Creation may have completed. This draft cannot be submitted again. Close and refresh the Matrix to verify the new variations before creating another batch.</p> : null}
    </>}
  </TrackerDialog>;
}
