import { publicEncrypt, constants } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY } from '../../../../lib/qa-supabase-env.js';
import { createClickUpClient } from '../../../../lib/services/clickup-client.js';
import { TEST_LIST, TEST_WORKSPACE, publicAdUrl, verifyLibraryDocument } from '../../../../lib/services/private-inspiration.js';

export const maxDuration = 60;
export async function POST(request) {
  const headers = {'Cache-Control':'no-store'};
  try {
    const authorization = request.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) return Response.json({error:'Sign in to QA first.'},{status:401,headers});
    const db = createClient(QA_SUPABASE_URL,QA_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:authorization}}});
    const auth = await db.auth.getUser(authorization.slice(7));
    if (auth.error || !auth.data.user) return Response.json({error:'QA session expired.'},{status:401,headers});
    const input = await request.json();
    const workers = await db.rpc('qa_inspiration_workers_list',{p_product_id:input.productId});
    const worker = workers.data?.find(row=>row.id === input.workerId);
    if (workers.error || !worker?.delivery_public_key || !worker.enabled || !worker.classifier_available) throw new Error('The selected classifier is unavailable.');
    if(worker.scope==='shared' && input.productId!=='qa-sample-astrorekha') throw new Error('Shared worker is limited to the QA sample.');
    const source = await db.from('inspirations').select('url,data').eq('product_id',input.productId).eq('id',input.inspirationId).single();
    if (source.error || source.data?.data?._qaCreatedBy !== auth.data.user.id) throw new Error('Select an inspiration created by your account.');
    publicAdUrl(source.data.url);
    const product = await db.from('products').select('config').eq('id',input.productId).single();
    if (product.error || product.data?.config?.clickup_list_id !== TEST_LIST) throw new Error('Link the approved QA test list first.');
    const token = request.headers.get('x-clickup-token');
    await createClickUpClient(token,{signal:AbortSignal.timeout(30000)}).inspect(TEST_LIST);
    const libraryId=product.data.config.qa_brief_doc_id;
    if(worker.scope==='shared' && (libraryId!=='8cq1r3y-44896' || product.data.config.qa_brief_tracker_page_id!=='8cq1r3y-118036')) throw new Error('Shared QA library destination changed.');
    if (!/^[\w-]+$/.test(libraryId || '') || !product.data.config.qa_brief_tracker_page_id || product.data.config.qa_brief_visibility!=='PUBLIC') throw new Error('Set up this product\'s workspace-visible QA Inspiration Library through the ClickUp connector first.');
    const library=await fetch(`https://api.clickup.com/api/v3/workspaces/${TEST_WORKSPACE}/docs/${libraryId}`,{headers:{Authorization:token},redirect:'error',signal:AbortSignal.timeout(30000)});
    if(!library.ok)throw new Error(`Your ClickUp account cannot access the QA Inspiration Library (${library.status}). Ask its owner to grant you Doc access.`);
    verifyLibraryDocument(await library.json(),libraryId);
    const sealed = publicEncrypt({key:worker.delivery_public_key,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(token)).toString('base64');
    const result = input.recoveryJobId
      ? await db.rpc('qa_private_inspiration_retry_delivery',{p_id:input.recoveryJobId,p_product_id:input.productId,p_inspiration_id:input.inspirationId,p_worker_id:input.workerId,p_sealed_token:sealed})
      : await db.rpc('qa_private_inspiration_enqueue',{p_request_id:input.requestId,p_product_id:input.productId,p_id:input.inspirationId,p_worker_id:input.workerId,p_sealed_token:sealed});
    if (result.error) throw new Error(result.error.message);
    return Response.json(result.data,{headers});
  } catch (error) {
    return Response.json({error:error instanceof Error?error.message:'Could not queue private inspiration.'},{status:400,headers});
  }
}
