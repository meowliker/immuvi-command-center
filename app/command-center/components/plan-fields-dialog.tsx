'use client';

import { useEffect, useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActionRecord } from '../types';
import type { TrackerSchema } from '../hooks/use-tracker-actions';
import { planEditableFields, planFieldDraft, planFieldChanges } from '../../../lib/domain/action-plan-fields.js';
import { requestQaClickUp } from '../services/qa-clickup';
import { TrackerDialog } from './tracker-dialog';
import { TrackerCustomFields } from './tracker-custom-fields';
import styles from '../../command-center.module.css';

export function PlanFieldsDialog({ db, productId, action, busy, error, save, close }: {
  db: SupabaseClient; productId: string; action: ActionRecord; busy: boolean; error: string;
  save: (action: ActionRecord, changes: Record<string, unknown>, push: boolean) => Promise<unknown>; close: () => void;
}) {
  const [schema, setSchema] = useState<TrackerSchema | null>(null);
  const [baseline, setBaseline] = useState<Record<string, unknown>>({});
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [localError, setLocalError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [push, setPush] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLocalError('');
    requestQaClickUp(db, productId, { operation: 'creative-schema' }, controller.signal).then((value: TrackerSchema) => {
      if (controller.signal.aborted) return;
      const initial = planFieldDraft(planEditableFields(value), action.linkedAdMeta);
      setSchema(value); setBaseline(initial); setDraft(initial);
    }).catch((cause) => { if (!controller.signal.aborted) setLocalError(cause instanceof Error ? cause.message : 'Could not load fields.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [db, productId, action, attempt]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLocalError('');
    if (!schema) return;
    try { await save(action, planFieldChanges(planEditableFields(schema), draft, baseline, schema.members), push); }
    catch (cause) { setLocalError(cause instanceof Error ? cause.message : 'Could not save fields.'); }
  }
  return <TrackerDialog title={`Assignments and fields: ${action.display.title}`} onClose={close} closeLabel="Close Action Plan fields" busy={busy} error={localError || error}>
    {loading ? <p role="status">Loading ClickUp fields...</p> : schema ? <form onSubmit={submit}>
      <fieldset className={styles.trackerForm} disabled={busy}>
        <TrackerCustomFields fields={planEditableFields(schema)} members={schema.members} values={draft} onChange={(id, value) => setDraft((current) => ({ ...current, [id]: value }))} />
        <footer>{action.display.clickupTaskId ? <label className={styles.trackerCheck}><input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} />Update linked ClickUp task</label> : null}
          <button type="submit"><Save size={16} />{busy ? 'Saving...' : 'Save assignments and fields'}</button></footer>
      </fieldset>
    </form> : <button type="button" onClick={() => setAttempt((value) => value + 1)}><RotateCcw size={16} />Retry field loading</button>}
  </TrackerDialog>;
}
