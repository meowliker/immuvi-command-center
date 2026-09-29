'use client';
import { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Inspiration } from '../hooks/use-inspiration-library';
import { inspirationBatchCandidates, inspirationBatchRequests, INSPIRATION_BATCH_LIMIT } from '../../../lib/domain/inspiration-batch.js';
import { importInspirationBatch } from '../../../lib/services/inspiration-batch.js';
import { readProductRows } from '../../../lib/services/product-rows.js';
import { requestQaClickUp } from '../services/qa-clickup';
import { TrackerDialog } from './tracker-dialog';
import styles from '../inspiration.module.css';

type Entry = ReturnType<typeof inspirationBatchRequests>[number];
export function InspirationBatchImport({db,productId,rows,run,close}:{db:SupabaseClient;productId:string;rows:Inspiration[];run:(op:()=>Promise<unknown>)=>Promise<unknown>;close:()=>void}) {
  const [results,setResults]=useState<Record<string,any>[]>([]),[selected,setSelected]=useState<string[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0);
  const [entries,setEntries]=useState<Entry[]>([]),lock=useRef(false),pending=useRef<Entry[]>([]);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');setResults([]);setSelected([]);
    void readProductRows(db,'inspiration_results',productId,controller.signal).then((next)=>{if(!controller.signal.aborted)setResults(next);})
      .catch((cause)=>{if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Could not read results.');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[db,productId,attempt]);
  const candidates=inspirationBatchCandidates(productId,rows,results);
  const eligible=candidates.filter((item)=>!item.issue);
  const unfinished=entries.some((entry)=>['pending','uncertain'].includes(entry.status));
  const uncertain=entries.some((entry)=>entry.status==='uncertain');
  async function execute() {
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try {
      if(!pending.current.length){pending.current=inspirationBatchRequests(productId,candidates,selected);setEntries(pending.current);}
      await run(async()=>{
        pending.current=await importInspirationBatch(db,pending.current,{
          pushCreative:(adId:string)=>requestQaClickUp(db,productId,{operation:'push-creative',adId}),
          progress:(next:Entry[])=>{pending.current=next;setEntries(next);},
        });
        setEntries(pending.current);
      });
    }catch(cause){setError(cause instanceof Error?cause.message:'Import failed.');}
    finally{lock.current=false;setBusy(false);}
  }
  return <TrackerDialog title="Import classification results" busy={busy} error={error} closeLabel="Close batch import" onClose={close}>
    {loading?<p role="status">Loading classification results...</p>:entries.length?<>
      <p role="status">{entries.filter((entry)=>entry.status==='imported').length} imported; {entries.filter((entry)=>entry.status==='failed').length} failed; {entries.filter((entry)=>['pending','uncertain'].includes(entry.status)).length} remaining.</p>
      {uncertain?<p>The last request may already be saved. Retry uses the same receipt before continuing.</p>:null}
      <ul className={styles.batchRows}>{entries.map((entry)=><li key={entry.id}><strong>{entry.title}</strong><span>{entry.status}</span>{entry.error?<p>{entry.error}</p>:null}{entry.warning?<p>{entry.warning}</p>:null}</li>)}</ul>
    </>:<>
      <p>{eligible.length} eligible results. Selected imports may update linked creative names and their QA ClickUp tasks. No classifier will run.</p>
      <div className={styles.commands}><button type="button" disabled={!!error || !eligible.length} onClick={()=>setSelected(eligible.slice(0,INSPIRATION_BATCH_LIMIT).map((item)=>item.id))}>Select up to {INSPIRATION_BATCH_LIMIT}</button><button type="button" onClick={()=>setSelected([])}>Clear selection</button><button type="button" aria-label="Reload batch results" title="Reload results" onClick={()=>setAttempt((old)=>old+1)}><RefreshCw size={15}/></button></div>
      {!candidates.length && !error?<p>No saved results found.</p>:null}
      <ul className={styles.batchRows}>{candidates.map((item)=><li key={item.id}><label><input type="checkbox" aria-label={`Import ${item.id}`} checked={selected.includes(item.id)} disabled={!!item.issue || !!error || (!selected.includes(item.id)&&selected.length>=INSPIRATION_BATCH_LIMIT)} onChange={(event)=>setSelected((old)=>event.target.checked?[...old,item.id]:old.filter((id)=>id!==item.id))}/><strong>{item.title}</strong></label><span>{item.issue || 'Ready'}</span></li>)}</ul>
    </>}
    <footer className={styles.editorFooter}><button type="button" disabled={busy} onClick={close}>{entries.length?'Close':'Cancel'}</button>
      {!entries.length || unfinished?<button type="button" disabled={busy || loading || (!entries.length && (!!error || !selected.length))} onClick={()=>void execute()}><Download size={15}/>{busy?'Importing...':uncertain?'Retry same batch':entries.length?'Continue import':`Import selected (${selected.length})`}</button>:null}
    </footer>
  </TrackerDialog>;
}
