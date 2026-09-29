import { publicEncrypt, constants } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY } from '../../../../lib/qa-supabase-env.js';
import { createClickUpClient } from '../../../../lib/services/clickup-client.js';

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
    if(input.productId!=='qa-sample-astrorekha' || !['variation','strategist'].includes(input.kind))throw new Error('Invalid QA analysis request.');
    const workers=await db.rpc('qa_analysis_workers',{p_product_id:input.productId});
    const worker=workers.data?.find(w=>w.id===input.workerId && w.enabled && w.analysis_protocol===1);
    if(workers.error || !worker?.delivery_public_key)throw new Error('Selected shared analysis worker is unavailable.');
    const token=request.headers.get('x-clickup-token');
    const cu=createClickUpClient(token,{signal:AbortSignal.timeout(30000)});
    await cu.inspect('1301130000002447');
    const sealed=publicEncrypt({key:worker.delivery_public_key,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(token)).toString('base64');
    const result=await db.rpc('qa_analysis_enqueue',{p_id:input.id,p_product_id:input.productId,p_worker_id:input.workerId,p_kind:input.kind,
      p_sealed_token:sealed,p_parent:input.parentId || null,p_target:input.targetId || null,p_file:input.fileId || null});
    if(result.error)throw new Error(result.error.message);
    return Response.json(result.data,{headers});
  } catch(error) {return Response.json({error:error instanceof Error?error.message:'Could not queue shared analysis.'},{status:400,headers});}
}
