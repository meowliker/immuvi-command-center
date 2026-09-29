'use client';
import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Inspiration } from '../hooks/use-inspiration-library';
import { inspirationRequest } from '../../../lib/domain/inspiration-editing.js';
import { mutateInspiration } from '../../../lib/services/inspiration-mutations.js';
import { readProductRows } from '../../../lib/services/product-rows.js';
import { TrackerDialog } from './tracker-dialog';
import { requestQaClickUp } from '../services/qa-clickup';
import styles from '../inspiration.module.css';

export function InspirationActionDialog({ db, productId, row, operation, close, done, run }: { db: SupabaseClient; productId: string; row: Inspiration; operation: string;
  close: () => void; done: (notice: string) => void; run: (op: () => Promise<unknown>) => Promise<unknown> }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [results, setResults] = useState<Record<string,any>[]>([]);
  const [loading, setLoading] = useState(operation === 'import'), [resultId, setResultId] = useState(''), [attempt,setAttempt] = useState(0);
  const [uncertain,setUncertain] = useState(false); const pending = useRef<ReturnType<typeof inspirationRequest> | null>(null), lock = useRef(false);
  useEffect(() => {
    if (operation !== 'import') return;
    const controller = new AbortController(); setLoading(true); setError('');
    void readProductRows(db,'inspiration_results',productId,controller.signal).then((rows) => {
      if (controller.signal.aborted) return;
      const own = rows.filter((result) => result.product_id === productId && result.ins_id === row.id).sort((a,b) => Date.parse(b.classified_at)-Date.parse(a.classified_at));
      setResults(own); setResultId(own[0]?.id || '');
    }).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not read results.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  },[db,productId,row.id,operation,attempt]);
  const labels: Record<string,string> = { approve:'Approve inspiration',delete:'Delete inspiration',requeue:'Requeue inspiration',dismiss_duplicate:'Mark duplicate reviewed',import:'Import classification result' };
  async function confirm() {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try {
      const selected = results.find((result) => result.id === resultId);
      pending.current ||= inspirationRequest(productId,operation,row,{},operation === 'import' ? { result_id:selected?.id,result_at:selected?.classified_at } : {});
      let notice = '';
      await run(async () => {
        try {
          const result = await mutateInspiration(db,pending.current!);
          let failed = 0;
          for (const id of result.remoteAdIds) {
            try { const pushed = await requestQaClickUp(db,productId,{operation:'push-creative',adId:id}); if (pushed.failed?.length) failed++; }
            catch { failed++; }
          }
          notice = operation === 'requeue' ? 'Retry state reset. Classifier dispatch remains blocked in QA.' : operation === 'delete' ? 'Inspiration, queue entry and classification result deleted. Existing creatives and ClickUp tasks were preserved.' : `${labels[operation]} completed.${failed ? ` ${failed} linked ClickUp updates remain pending in Creative Tracker.` : ''}`;
        } catch (cause) { setUncertain(!(cause as { definite?: boolean }).definite); if ((cause as { definite?:boolean }).definite) pending.current=null; setError(cause instanceof Error ? cause.message : 'Request failed.'); }
      });
      if (notice) done(notice);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not start this operation.'); }
    finally { lock.current=false;setBusy(false); }
  }
  return <TrackerDialog title={labels[operation]} busy={busy} error={error} closeLabel="Close inspiration action" onClose={close}>
    <p><strong>{row.formatName}</strong></p>
    {operation === 'delete' ? <p>This removes the inspiration, its queue entry and saved classification result. Its {row.usage.length} existing creatives and any ClickUp tasks will not be deleted.</p>
      : operation === 'requeue' ? <p>Attempts, claims, errors and the processed timestamp will be reset. Processing stays blocked until an isolated QA classifier is verified.</p>
      : operation === 'approve' ? <p>Make this inspiration available as an approved source. No creative or ClickUp task will be created.</p>
      : operation === 'dismiss_duplicate' ? <p>{row.duplicate || 'No duplicate details saved.'} The match evidence is retained for future review.</p> : <>
        {loading ? <p role="status">Loading classification results...</p> : results.length ? <label className={styles.resultSelect}>Classification result<select aria-label="Classification result" disabled={busy || uncertain} value={resultId} onChange={(event) => setResultId(event.target.value)}>{results.map((result) => <option key={result.id} value={result.id}>{new Date(result.classified_at).toLocaleString()}</option>)}</select></label> : <p>No classification results for this inspiration.</p>}
        <p>Imports the stored classification and complete eight-section brief. A changed format name also updates linked QA creatives and their pending ClickUp names. No classifier will run.</p>
        {error && !uncertain ? <button type="button" onClick={() => setAttempt((value) => value+1)}>Reload results</button> : null}
      </>}
    {uncertain ? <p role="status">The operation may already be saved. Retry recovers the same request without repeating it.</p> : null}
    <footer className={styles.editorFooter}><button type="button" disabled={busy} onClick={close}>Cancel</button><button type="button" disabled={busy || loading || (operation === 'import' && !resultId)} onClick={() => void confirm()}>{busy ? 'Saving...' : uncertain ? 'Retry same request' : labels[operation]}</button></footer>
  </TrackerDialog>;
}
