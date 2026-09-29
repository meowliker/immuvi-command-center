import { QA_SUPABASE_URL } from '../qa-supabase-env.js';
export async function recoverInspiration(db,request) {
  if(db.supabaseUrl?.replace(/\/$/,'')!==QA_SUPABASE_URL)throw Object.assign(new Error('Inspiration recovery is restricted to QA.'),{definite:true});
  const result=await db.rpc('qa_inspiration_recover',request);
  if(result.error)throw Object.assign(new Error(result.error.message || 'Recovery failed.'),{definite:/^(P0001|22|23|42501)/.test(result.error.code || '')});
  const saved=result.data,q=saved?.queue,row=saved?.row,old=request.p_expected_queue;
  if(!saved || saved.requestId!==request.p_request_id || saved.productId!==request.p_product_id || saved.operation!=='recover' || saved.id!==old.ins_id || saved.dispatchEnabled!==false
    || row?.id!==old.ins_id || row.product_id!==request.p_product_id || !row.updated_at || row.status!=='Blocked' || row.url!==old.url
    || q?.id!==request.p_queue_id || q.product_id!==request.p_product_id || q.ins_id!==old.ins_id || q.url!==old.url
    || q.status!=='blocked' || q.worker_assignment!=='blocked:qa-isolation' || q.claimed_by!==null || q.claimed_at!==null
    || q.attempts!==old.attempts || q.queued_at!==old.queued_at || q.processed_at!==old.processed_at)
    throw new Error('Recovery could not be verified. Retry the same request to recover its acknowledgement.');
  return saved;
}
