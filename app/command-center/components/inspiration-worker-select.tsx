'use client';
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import styles from '../inspiration.module.css';

type Worker={id:string;name:string;scope:string;enabled:boolean;classifier_available:boolean;heartbeat_at:string;can_manage:boolean};
export function InspirationWorkerSelect({db,productId,disabled=false}:{db:SupabaseClient;productId:string;disabled?:boolean}) {
 const [workers,setWorkers]=useState<Worker[]>([]),[selected,setSelected]=useState(''),[storageKey,setStorageKey]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false);
 useEffect(()=>{
  let cancelled=false;
  async function load(){
   try {
   const [session,response]=await Promise.all([db.auth.getSession(),db.rpc('qa_inspiration_workers_list',{p_product_id:productId})]);
   if(!session.data.session)throw new Error('Sign in to QA first.');
   const key=`immuvi-worker:${session.data.session.user.id}:${productId}`;
   if(cancelled)return;
   if(response.error || !Array.isArray(response.data)){setError('Worker selection is unavailable.');return;}
   setWorkers(response.data);setStorageKey(key);setSelected(localStorage.getItem(key)||'');setError('');
   }catch {if(!cancelled)setError('Worker selection is unavailable.');}
  }
  void load();const timer=setInterval(()=>void load(),10000);
  return ()=>{cancelled=true;clearInterval(timer);};
 },[db,productId]);
 const worker=workers.find(w=>w.id===selected);
 async function toggle(){
  if(!worker?.can_manage || saving)return;
  setSaving(true);
  try {
  const result=await db.rpc('qa_private_worker_set_enabled',{p_id:worker.id,p_enabled:!worker.enabled});
  if(result.error)setError('Could not change worker state.');
  else setWorkers(rows=>rows.map(w=>w.id===worker.id?{...w,enabled:!w.enabled}:w));
  }catch {setError('Could not change worker state.');}finally{setSaving(false);}
 }
 return <div>
  <label className={styles.runOn}><span>Run on</span><select aria-label="Run inspiration on" disabled={disabled || !storageKey} value={selected} onChange={event=>{setSelected(event.target.value);localStorage.setItem(storageKey,event.target.value);}}>
   <option value="">My private worker</option>
   {selected && !worker?<option value={selected}>Selected worker unavailable</option>:null}
   {workers.map(w=><option key={w.id} value={w.id}>{w.name} ({w.scope}){!w.enabled?' — paused':!w.classifier_available || Date.now()-Date.parse(w.heartbeat_at)>=45000?' — offline':''}</option>)}
  </select></label>
  {worker?.scope==='shared' && worker.can_manage?<button type="button" disabled={saving} onClick={()=>void toggle()}>{worker.enabled?'Pause new jobs':'Resume worker'}</button>:null}
  {error?<p role="alert">{error}</p>:null}
 </div>;
}
