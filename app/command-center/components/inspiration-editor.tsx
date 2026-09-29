'use client';
import { useRef, useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Inspiration } from '../hooks/use-inspiration-library';
import { INSPIRATION_FIELDS, inspirationDraft, inspirationRequest } from '../../../lib/domain/inspiration-editing.js';
import { saveInspiration } from '../services/save-inspiration';
import { InspirationWorkerSelect } from './inspiration-worker-select';
import { TrackerDialog } from './tracker-dialog';
import { ProductFieldInput } from './product-field-catalog';
import styles from '../inspiration.module.css';

const labels: Record<string,string> = { formatName:'Format name',formatDetail:'Format detail',brand:'Brand',platform:'Platform',addedBy:'Added by',angle:'Angle',persona:'Persona',hookType:'Hook type',creativeStructure:'Creative structure',productionStyle:'Production style',funnelStage:'Funnel',adType:'Ad type',creativeHypothesis:'Hypothesis',notes:'Notes',bodyCopy:'Ad copy',voiceOver:'Voice over' };
export function InspirationEditor({ db, productId, row, mode, run, close, done, compact = false, children }: { db: SupabaseClient; productId: string; row: Inspiration | null; mode: 'url'|'manual'|'edit'; compact?: boolean; children?: ReactNode;
  run: (operation: () => Promise<unknown>) => Promise<unknown>; close: () => void; done: (notice: string) => void }) {
  const [fields, setFields] = useState<Record<string,string>>(() => inspirationDraft(row));
  const [url, setUrl] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const pending = useRef<ReturnType<typeof inspirationRequest> | null>(null); const lock = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  async function save() {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try {
      if (!pending.current) {
        const values = mode === 'url' ? { sourceUrl: url } : mode === 'manual' ? { ...fields, sourceUrl: url }
          : Object.fromEntries(Object.entries(fields).filter(([key,value]) => value !== inspirationDraft(row)[key]));
        pending.current = inspirationRequest(productId, row ? 'save' : 'create', row, values, row ? {} : { mode });
      }
      let notice = '';
      await run(async () => {
        try {
          notice = await saveInspiration(db,pending.current!);
        } catch (cause) { setUncertain(!(cause as { definite?:boolean }).definite); if ((cause as { definite?:boolean }).definite) pending.current=null; setError(cause instanceof Error ? cause.message : 'Could not save inspiration.'); }
      });
      if (notice) { pending.current=null;setUncertain(false);setUrl('');done(notice); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Invalid draft.'); }
    finally { lock.current = false; setBusy(false); }
  }
  const enums: Record<string,string[]> = { platform:['Facebook','Instagram','TikTok','YouTube','Other'],funnelStage:['TOF','MOF','BOF'],adType:['Video','Photo','Carousel','UGC','VSL'] };
  if(compact)return <>
    <form className={styles.queueToolbar} aria-label="Add inspiration to queue" onSubmit={(event)=>{event.preventDefault();void save();}}>
      <input aria-label="Source URL" type="url" required maxLength={4000} placeholder="Paste ad URL or Google Drive video link..." value={url} disabled={busy || uncertain} onChange={(event)=>setUrl(event.target.value)}/>
      <InspirationWorkerSelect key={productId} db={db} productId={productId} disabled={busy || uncertain}/>
      <button className={styles.addQueue} type="submit" disabled={busy}>{busy?'Saving...':uncertain?'Retry same save':'+ Add to Queue'}</button>
      {children}
    </form>
    {error?<p role="alert" className={styles.error}>{error}</p>:null}
    {uncertain?<p role="status" className={styles.notice}>The request may already be saved. Retry uses the same request ID.</p>:null}
  </>;
  return <TrackerDialog title={mode === 'url' ? 'Add to inspiration queue' : mode === 'manual' ? 'Add manual inspiration' : `Edit inspiration: ${row?.formatName}`} busy={busy} error={error} closeLabel="Close inspiration editor" onClose={close}>
    <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <fieldset disabled={busy || uncertain} className={styles.editorFields}>
        {mode !== 'edit' ? <label className={styles.wide}>Source URL<input type="url" required maxLength={4000} value={url} onChange={(event) => setUrl(event.target.value)} /></label> : null}
        {mode !== 'url' ? [...INSPIRATION_FIELDS,...(row?['formatDetail']:[])].map((key) => <label key={key} className={['creativeHypothesis','notes','bodyCopy','voiceOver','formatDetail'].includes(key) ? styles.wide : ''}>{labels[key]}
          {enums[key] ? <select aria-label={labels[key]} value={fields[key]} onChange={(event) => setFields({ ...fields,[key]:event.target.value })}><option value="">-</option>{[...new Set([...enums[key],fields[key]].filter(Boolean))].map((value) => <option key={value}>{value}</option>)}</select>
            : ['creativeHypothesis','notes','bodyCopy','voiceOver','formatDetail'].includes(key) ? <textarea aria-label={labels[key]} rows={3} value={fields[key]} onChange={(event) => setFields({ ...fields,[key]:event.target.value })} />
            : ['creativeStructure','hookType','productionStyle'].includes(key) ? <ProductFieldInput field={key} label={labels[key]} value={fields[key]} onChange={(value) => setFields({ ...fields,[key]:value })} />
            : <input aria-label={labels[key]} required={key === 'formatName'} maxLength={key === 'formatName' ? 200 : 20000} value={fields[key]} onChange={(event) => setFields({ ...fields,[key]:event.target.value })} />}
        </label>) : null}
      </fieldset>
      {row?.usage.length ? <p>Renaming also updates {row.usage.length} linked creatives and their Action Plan names. Classifier brief links are preserved.</p> : null}
      {uncertain ? <p role="status">The request may already be saved. Retry uses the same request ID; close and reopen to change the draft.</p> : null}
      <footer className={styles.editorFooter}><button type="button" disabled={busy} onClick={close}>Cancel</button><button type="submit" disabled={busy}>{busy ? 'Saving...' : uncertain ? 'Retry same save' : mode === 'url' ? 'Add to queue' : 'Save inspiration'}</button></footer>
    </form>
  </TrackerDialog>;
}
