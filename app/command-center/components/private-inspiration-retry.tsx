'use client';
import { useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { queuePrivateInspiration } from '../services/queue-private-inspiration';
import { privateInspirationRetry } from '../../../lib/domain/private-inspiration-queue.js';

export function PrivateInspirationRetry({db,productId,inspirationId,done}:{db:SupabaseClient;productId:string;inspirationId:string;done:(message:string)=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const request=useRef(''),locked=useRef(false);
  async function retry() {
    if(locked.current)return;
    locked.current=true;setBusy(true);setError('');
    try {
      const jobs=await db.rpc('qa_private_inspiration_status',{p_product_id:productId});
      if(jobs.error || !Array.isArray(jobs.data))throw new Error('Could not read your queue. Please try again.');
      const recovery=privateInspirationRetry(jobs.data,inspirationId);
      request.current ||= crypto.randomUUID();
      await queuePrivateInspiration(db,{productId,inspirationId,requestId:request.current,...recovery});
      request.current='';
      const hasResult=jobs.data.some((job:Record<string,any>)=>job.id===recovery.recoveryJobId && job.has_result);
      done(hasResult?'Saved brief requeued for delivery.':'Inspiration requeued for processing.');
    } catch(error) {
      const message=error instanceof Error?error.message:'Could not requeue inspiration.';
      if(message.startsWith('Previous attempt failed.'))request.current='';
      setError(message);
    } finally {locked.current=false;setBusy(false);}
  }
  return <div><button type="button" disabled={busy} onClick={()=>void retry()}><RotateCcw size={14}/>{busy?'Queuing...':'Requeue'}</button>{error?<p role="alert">{error}</p>:null}</div>;
}
