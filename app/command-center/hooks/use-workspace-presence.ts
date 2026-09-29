'use client';
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export type OnlineMember = { id:string; name:string };

export function useWorkspacePresence(db:SupabaseClient, userId:string, clickUpUserId:string|null=null) {
  const [members,setMembers]=useState<OnlineMember[]>([]);
  const [status,setStatus]=useState<'connecting'|'online'|'unavailable'>('connecting');
  useEffect(()=>{
    const sessionId=crypto.randomUUID();
    let disposed=false,request:AbortController|null=null;
    const heartbeat=async()=>{
      if(disposed || request)return;
      if(!navigator.onLine){setMembers([]);setStatus('unavailable');return;}
      request=new AbortController();
      try {
        const {data,error}=await db.rpc('qa_presence',{p_session_id:sessionId,p_leave:false,p_clickup_user_id:clickUpUserId}).abortSignal(AbortSignal.any([request.signal,AbortSignal.timeout(15_000)]));
        if(disposed)return;
        if(error || !navigator.onLine || !Array.isArray(data) || data.some(item=>typeof item?.id!=='string' || typeof item?.name!=='string'))throw new Error('Presence unavailable');
        setMembers(data);setStatus('online');
      }catch{if(!disposed){setMembers([]);setStatus('unavailable');}}
      finally{request=null;}
    };
    const offline=()=>{request?.abort();setMembers([]);setStatus('unavailable');};
    const visible=()=>{if(!document.hidden)void heartbeat();};
    void heartbeat();
    const timer=window.setInterval(()=>void heartbeat(),30_000);
    window.addEventListener('online',heartbeat);window.addEventListener('offline',offline);
    document.addEventListener('visibilitychange',visible);
    return()=>{
      disposed=true;request?.abort();window.clearInterval(timer);
      window.removeEventListener('online',heartbeat);window.removeEventListener('offline',offline);
      document.removeEventListener('visibilitychange',visible);
      void db.rpc('qa_presence',{p_session_id:sessionId,p_leave:true}).then(()=>{});
    };
  },[db,userId,clickUpUserId]);
  return {members,status};
}
