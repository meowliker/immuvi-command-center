import type { SupabaseClient } from '@supabase/supabase-js';
import { qaClickUpToken } from './qa-clickup';

export async function queuePrivateInspiration(db:SupabaseClient, input:{productId:string;inspirationId:string;requestId:string;workerId?:string;recoveryJobId?:string}) {
  const {data,error}=await db.auth.getSession();
  if(error || !data.session)throw new Error('Sign in to QA first.');
  const token=qaClickUpToken(data.session.user.id);
  if(!token)throw new Error('Enter your ClickUp key first.');
  const workers=await db.rpc('qa_inspiration_workers_list',{p_product_id:input.productId});
  if(workers.error || !Array.isArray(workers.data))throw new Error('Could not check available workers.');
  const selected=input.workerId || (typeof localStorage!=='undefined' ? localStorage.getItem(`immuvi-worker:${data.session.user.id}:${input.productId}`) : null);
  const worker=workers.data.find((row:Record<string,any>)=>(selected ? row.id===selected : row.scope!=='shared')
    && row.enabled && row.classifier_available && Date.now()-Date.parse(row.heartbeat_at)<45000);
  if(!worker)throw new Error('The selected classifier is offline or paused.');
  const response=await fetch('/api/workers/inspiration',{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,
    'X-ClickUp-Token':token,'Content-Type':'application/json'},body:JSON.stringify({...input,workerId:worker.id})});
  const body=await response.json();
  if(!response.ok || body.error)throw new Error(body.error || 'Could not queue inspiration.');
  if(body.status==='failed')throw new Error('Previous attempt failed. Review its error in Activity before trying again.');
  if(body.inspirationId!==input.inspirationId || body.id!==(input.recoveryJobId || input.requestId)
    || !['pending','running','done'].includes(body.status))throw new Error('Queue acknowledgement could not be verified. Check Activity before retrying.');
  return {status:body.status as 'pending'|'running'|'done',workerName:worker.name as string};
}
