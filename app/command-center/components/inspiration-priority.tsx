'use client';
import { useRef, useState } from 'react';
import { ArrowUp, ArrowDown, ArrowUpToLine } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';

export function InspirationPriority({db,jobId,refresh}:{db:SupabaseClient;jobId:string;refresh:()=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const lock=useRef(false);
  async function move(direction:string) {
    if(lock.current)return;
    lock.current=true;setBusy(true);setError('');
    try {
      const result=await db.rpc('qa_private_inspiration_move',{p_id:jobId,p_direction:direction});
      if(result.error)throw new Error(result.error.message);
      refresh();
    } catch(error) {setError(error instanceof Error?error.message:'Could not change queue order.');}
    finally {lock.current=false;setBusy(false);}
  }
  return <div><div role="group" aria-label="Queue priority">
    {([['top','Run next',ArrowUpToLine],['up','Move up',ArrowUp],['down','Move down',ArrowDown]] as const).map(([direction,label,Icon])=><button key={direction} type="button" title={label} aria-label={label} disabled={busy} onClick={()=>void move(direction)}><Icon size={14}/></button>)}
  </div>{error?<p role="alert">{error}</p>:null}</div>;
}
