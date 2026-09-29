'use client';
import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActionRecord, Creative } from '../types';
import { normalizeCreativeRow } from '../../../lib/domain/creative-tracker.js';
import { planCreativeValues } from '../../../lib/domain/action-plan-editing.js';
import { readProductRows } from '../../../lib/services/product-rows.js';
import { TrackerDialog } from './tracker-dialog';
import { TrackerEditor } from './tracker-editor';

export function PlanCreativeDialog({ db, productId, action, busy, error, save, close }: {
  db: SupabaseClient; productId: string; action: ActionRecord; busy: boolean; error: string;
  save: (action: ActionRecord, values: Record<string, unknown>, push: boolean) => Promise<unknown>; close: () => void;
}) {
  return <TrackerDialog title={`Creative details: ${action.display.title}`} closeLabel="Close Action Plan creative" onClose={close} busy={busy} error={error}>
    <PlanCreativeEditor db={db} productId={productId} action={action} busy={busy} save={save} />
  </TrackerDialog>;
}

export function PlanCreativeEditor({ db, productId, action, busy, save }: {
  db: SupabaseClient; productId: string; action: ActionRecord; busy: boolean;
  save: (action: ActionRecord, values: Record<string, unknown>, push: boolean) => Promise<unknown>;
}) {
  const [loaded, setLoaded] = useState<{ creative: Creative; taxonomy: { angles: string[]; personas: string[] } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError('');
    async function load() {
      const [result, angles, personas] = await Promise.all([
        db.from('ads').select('*').eq('product_id', productId).eq('id', action.display.linkedAdId).abortSignal(controller.signal).single(),
        readProductRows(db, 'angles', productId, controller.signal), readProductRows(db, 'personas', productId, controller.signal),
      ]);
      if (result.error || !result.data || result.data.deleted_at) throw new Error('Could not load the linked creative.');
      if (result.data.updated_at !== action.adVersion) throw new Error('Creative changed. Close and reopen the editor to load the latest version.');
      if (!controller.signal.aborted) setLoaded({ creative: normalizeCreativeRow(result.data), taxonomy: {
        angles: angles.map((row) => String(row.name)), personas: personas.map((row) => String(row.name)),
      } });
    }
    void load().catch((cause) => { if (!controller.signal.aborted) setLoadError(cause instanceof Error ? cause.message : 'Could not load creative.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [db, productId, action, attempt]);
  return <>
    {loadError ? <p role="alert">{loadError}</p> : null}
    {loading ? <p role="status">Loading creative...</p> : loaded ? <TrackerEditor creative={loaded.creative} taxonomy={loaded.taxonomy}
      schema={null} loadSchema={async () => {}} includeCustom={false} includeWorkflow={false} busy={busy}
      save={async (_, draft, __, push) => { await save(action, planCreativeValues(loaded.creative, draft), push); }} />
      : <button type="button" onClick={() => setAttempt((value) => value + 1)}><RotateCcw size={16} />Retry creative loading</button>}
  </>;
}
