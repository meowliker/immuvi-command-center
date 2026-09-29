import { publicEncrypt, constants } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY } from '../../../../lib/qa-supabase-env.js';
import { createClickUpClient } from '../../../../lib/services/clickup-client.js';
import { canQueueImageWorker } from '../../../../lib/domain/image-producer.js';

export const maxDuration=60;
export async function POST(request) {
  const headers={'Cache-Control':'no-store'};
  try {
    const authorization=request.headers.get('authorization') || '';
    if(!authorization.startsWith('Bearer '))return Response.json({error:'Sign in to QA first.'},{status:401,headers});
    const db=createClient(QA_SUPABASE_URL,QA_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:authorization}}});
    const auth=await db.auth.getUser(authorization.slice(7));
    if(auth.error || !auth.data.user)return Response.json({error:'QA session expired.'},{status:401,headers});
    const input=await request.json();
    if(input.productId!=='qa-sample-astrorekha')throw new Error('Shared Producer is limited to the QA sample.');
    const workers=await db.rpc('qa_image_workers_list',{p_product_id:input.productId});
    const worker=workers.data?.find(w=>w.id===input.workerId && w.scope==='shared' && canQueueImageWorker(w));
    if(workers.error || !worker?.delivery_public_key)throw new Error('Selected shared Producer is unavailable.');
    const row=await db.from('ads').select('clickup_task_id,meta').eq('id',input.adId).eq('product_id',input.productId).single();
    if(row.error)throw new Error('Creative is unavailable.');
    const taskId=row.data.clickup_task_id || row.data.meta?._clickupId || row.data.meta?.clickupTaskId;
    const token=request.headers.get('x-clickup-token');
    const cu=createClickUpClient(token,{signal:AbortSignal.timeout(30000)});
    await cu.getTask('1301130000002447',taskId);
    const {list}=await cu.inspect('1301130000002447');
    if(!list.statuses.some(s=>String(s.status).toLowerCase()==='ready to launch'))throw new Error('The QA list needs its Ready to Launch status before image delivery.');
    const sealed=publicEncrypt({key:worker.delivery_public_key,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(token)).toString('base64');
    const result=input.recoveryId
      ? await db.rpc('qa_shared_image_retry',{p_id:input.recoveryId,p_product_id:input.productId,p_ad_id:input.adId,p_worker_id:input.workerId,p_sealed_token:sealed})
      : await db.rpc('qa_shared_image_enqueue',{p_request_id:input.requestId,p_product_id:input.productId,p_ad_id:input.adId,
        p_options:input.options,p_worker_id:input.workerId,p_sealed_token:sealed,p_task_id:taskId});
    if(result.error)throw new Error(result.error.message);
    return Response.json(result.data,{headers});
  } catch(error) {return Response.json({error:error instanceof Error?error.message:'Could not queue shared Producer.'},{status:400,headers});}
}
