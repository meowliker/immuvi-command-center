'use client';
import { useRef,useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Inspiration } from '../hooks/use-inspiration-library';
import { inspirationRecoveryIssue,inspirationRecoveryRequest } from '../../../lib/domain/inspiration-recovery.js';
import { recoverInspiration } from '../../../lib/services/inspiration-recovery.js';
import { TrackerDialog } from './tracker-dialog';
import styles from '../inspiration.module.css';

export function InspirationRecovery({db,productId,row,close,done,run}:{db:SupabaseClient;productId:string;row:Inspiration;close:()=>void;done:(notice:string)=>void;run:(op:()=>Promise<unknown>)=>Promise<unknown>}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false);
  const lock=useRef(false),pending=useRef<ReturnType<typeof inspirationRecoveryRequest>|null>(null);
  const issue=inspirationRecoveryIssue(row,productId);
  async function confirm() {
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try {
      pending.current ||= inspirationRecoveryRequest(productId,row);
      let saved=false;
      await run(async()=>{
        try {await recoverInspiration(db,pending.current!);saved=true;}
        catch(cause){const definite=!!(cause as {definite?:boolean}).definite;if(definite)pending.current=null;setUncertain(!definite);setError(cause instanceof Error?cause.message:'Recovery failed.');}
      });
      if(saved)done('Library record recovered. Saved results and existing creatives were preserved. Classifier dispatch remains blocked in QA.');
    } catch(cause){setError(cause instanceof Error?cause.message:'Could not start recovery.');}
    finally{lock.current=false;setBusy(false);}
  }
  return <TrackerDialog title="Recover queue entry" closeLabel="Close queue recovery" busy={busy} error={error || issue} onClose={close}>
    <p><strong>{row.id}</strong></p>
    <p>Restore the missing library record with its original ID and source URL. Saved classification results, existing creatives, attempts and retry dates are preserved.</p>
    <p>The original queue state is retained for audit. Processing will be blocked; no classifier, Matrix creative or ClickUp task will be started.</p>
    {uncertain?<p role="status">Recovery may already be saved. Retry uses the same request without creating another record.</p>:null}
    <footer className={styles.editorFooter}><button type="button" disabled={busy} onClick={close}>Cancel</button><button type="button" disabled={busy || !!issue} onClick={()=>void confirm()}>{busy?'Recovering...':uncertain?'Retry same recovery':'Recover library record'}</button></footer>
  </TrackerDialog>;
}
