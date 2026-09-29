'use client';
import { useRef, useState } from 'react';
import { Zap } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { queuePrivateInspiration } from '../services/queue-private-inspiration';
import styles from '../inspiration.module.css';

export function PrivateInspirationProcess({db,productId,workers,done}:{db:SupabaseClient;productId:string;workers:Record<string,any>[];done:(message:string)=>void}) {
  const [busy,setBusy]=useState(false);
  const requests=useRef(new Map<string,string>());
  const lock=useRef(false);
  const worker=workers.find(row=>row.enabled && row.classifier_available && Date.now()-Date.parse(row.heartbeat_at)<45000);
  async function process() {
    if (!worker || lock.current) return;
    lock.current=true;
    setBusy(true);
    done('');
    let count=0,recovered=0;
    try {
      const {data,error}=await db.auth.getSession();
      if(error || !data.session)throw new Error('Sign in to QA first.');
      const rows=await db.from('inspirations').select('id,data,status').eq('product_id',productId).eq('data->>_qaCreatedBy',data.session.user.id).in('status',['Blocked','blocked']);
      const jobs=await db.rpc('qa_private_inspiration_status',{p_product_id:productId});
      if(rows.error || jobs.error)throw new Error('Could not read your inspiration queue.');
      const active=new Set((jobs.data||[]).filter((job:Record<string,any>)=>job.status!=='failed').map((job:Record<string,any>)=>job.inspiration_id));
      for(const row of rows.data||[]) {
        if(active.has(row.id) || row.data?._clickupDocPageUrl)continue;
        const key=`${productId}:${row.id}`;
        const previous=(jobs.data||[]).find((job:Record<string,any>)=>job.inspiration_id===row.id && job.has_result);
        if(previous && !previous.can_retry_delivery)throw new Error('A saved brief has an uncertain delivery receipt. Review it before retrying to avoid a duplicate Doc.');
        if(!requests.current.has(key))requests.current.set(key,crypto.randomUUID());
        try {
          await queuePrivateInspiration(db,{productId,inspirationId:row.id,workerId:worker.id,requestId:requests.current.get(key)!,...(previous?{recoveryJobId:previous.id}:{})});
        } catch(error) {
          if(error instanceof Error && error.message.startsWith('Previous attempt failed.'))requests.current.delete(key);
          throw error;
        }
        requests.current.delete(key);count++;if(previous)recovered++;
      }
      done(count?`${count} inspiration${count===1?'':'s'} queued on ${worker.name}.${recovered?' Saved briefs will be delivered without regenerating.':''}`:'No new inspirations to process.');
    } catch(error) { done(`${count?`${count} queued. `:''}${error instanceof Error?error.message:'Could not queue inspiration.'}`); }
    finally {lock.current=false;setBusy(false);}
  }
  return <button type="button" className={styles.processQueue} disabled={!worker || busy} title={worker?worker.name:'Your private classifier is offline'} onClick={()=>void process()}><Zap size={14}/>{busy?'Queuing...':'Process All with Codex'}</button>;
}
