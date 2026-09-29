'use client';
import { useRef, useState } from 'react';
import { Square } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';

export function InspirationCancel({db,jobId,refresh}:{db:SupabaseClient;jobId:string;refresh:()=>void}) {
  const lock=useRef(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function cancel() {
    if(lock.current)return;
    lock.current=true;setBusy(true);setError('');
    try {
      const result=await db.rpc('qa_private_inspiration_cancel',{p_id:jobId});
      if(result.error)throw new Error(result.error.message);
      refresh();
    } catch(error) {setError(error instanceof Error?error.message:'Could not cancel the task.');}
    finally {lock.current=false;setBusy(false);}
  }
  return <div><button type="button" disabled={busy} onClick={()=>void cancel()} aria-label="Cancel task"><Square size={14}/>{busy?'Cancelling...':'Cancel task'}</button>{error?<p role="alert">{error}</p>:null}</div>;
}
