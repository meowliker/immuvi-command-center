'use client';
import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Play, RotateCcw } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { qaClickUpToken } from '../services/qa-clickup';
import styles from './shared-analysis-control.module.css';

type Worker = { id: string; name: string; enabled: boolean; analysis_protocol: number; heartbeat_at: string; codex_active: boolean; classifier_available: boolean };
type Run = { id: string; kind: string; status: string; error: string; worker_id: string; drive_file_id: string; can_resume: boolean; url?: string };
export function SharedAnalysisControl({ db, productId, kind, parentId, targetId, fileId }: {
  db: SupabaseClient; productId: string; kind: 'strategist' | 'variation'; parentId?: string; targetId?: string; fileId?: string;
}) {
  const [workers,setWorkers]=useState<Worker[]>([]),[workerId,setWorkerId]=useState('');
  const [run,setRun]=useState<Run | null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const requestId=useRef('');
  const revision=useRef(0);
  useEffect(()=>{
    let live=true;const controller=new AbortController();
    async function refresh() {
      const version=revision.current;
      const [w,r]=await Promise.all([db.rpc('qa_analysis_workers',{p_product_id:productId}).abortSignal(controller.signal),db.rpc('qa_analysis_status',{p_product_id:productId}).abortSignal(controller.signal)]);
      if(!live || version!==revision.current)return;
      setWorkers(!w.error && Array.isArray(w.data)?w.data:[]);
      if(!r.error && Array.isArray(r.data))setRun(r.data.find((row:Run)=>row.kind===kind && (kind==='strategist' || row.drive_file_id===fileId)) || null);
    }
    void refresh();const timer=setInterval(()=>void refresh(),10000);
    return ()=>{live=false;controller.abort();clearInterval(timer);};
  },[db,productId,kind,fileId]);
  const resumable=run?.status==='failed' && run.can_resume;
  const selected=workers.find(w=>w.id===(resumable?run.worker_id:workerId));
  const fresh=!!selected?.heartbeat_at && Date.parse(selected.heartbeat_at)>Date.now()-45000;
  const eligible=selected?.enabled && selected.analysis_protocol===1 && (!fresh || selected.codex_active && (kind!=='variation' || selected.classifier_available));
  const active=run && ['pending','running'].includes(run.status);
  async function queue() {
    if(!selected || !eligible || busy)return;
    revision.current++;
    setBusy(true);setError('');
    try {
      const {data}=await db.auth.getSession();
      if(!data.session)throw new Error('Sign in to QA first.');
      const token=qaClickUpToken(data.session.user.id);
      if(!token)throw new Error('Enter your ClickUp key first.');
      requestId.current ||= crypto.randomUUID();
      const id=resumable?run.id:requestId.current;
      const response=await fetch('/api/workers/analysis',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`,'X-ClickUp-Token':token},
        body:JSON.stringify({id,productId,workerId:selected.id,kind,parentId,targetId,fileId})});
      const result=await response.json();
      if(!response.ok || result.error)throw new Error(result.error || 'Could not queue analysis.');
      if(result.id!==id || !['pending','running','done'].includes(result.status))throw new Error('Queue acknowledgment could not be verified. Retry uses the same request.');
      revision.current++;setRun({...result,kind,worker_id:selected.id,drive_file_id:fileId || '',error:'',can_resume:false});requestId.current='';
    } catch(cause) {setError(cause instanceof Error?cause.message:'Could not queue analysis.');}
    finally {setBusy(false);}
  }
  return <div className={styles.control}>
    {kind==='variation' && run?.status==='done' && run.url ? <a href={run.url} target="_blank" rel="noreferrer"><ExternalLink size={14} />Winner brief</a> : <>
      <label>Run on<select aria-label={`${kind==='variation'?'Winner brief':'Strategist'} worker`} value={selected?.id || workerId} disabled={busy || !!active || !!resumable} onChange={e=>setWorkerId(e.target.value)}>
        <option value="">Choose shared worker</option>{workers.map(w=><option key={w.id} value={w.id} disabled={!w.enabled || w.analysis_protocol!==1}>{w.name}{w.analysis_protocol!==1?' (update required)':''}</option>)}
      </select></label>
      <button type="button" disabled={busy || !!active || !eligible || kind==='variation' && run?.status==='failed' && !run.can_resume} onClick={()=>void queue()}>
        {resumable?<RotateCcw size={14}/>:<Play size={14}/>}{busy?'Queueing...':active?run.status==='running'?'Processing':'Queued':resumable?'Resume saved run':kind==='variation'?'Generate winner brief':'Run Strategist'}
      </button>
    </>}
    {error || run?.error ? <details className={styles.error}><summary>Needs attention</summary><p role="alert">{error || run?.error}</p></details>:null}
  </div>;
}
