import { QA_SUPABASE_URL } from '../qa-supabase-env.js';
import { assertQaClickUpList } from '../domain/clickup-sync.js';
import { productClickUpListId } from '../domain/product-config.js';
import { clickUpDocumentUrl, findClickUpBrief } from '../domain/inspiration-context.js';

export async function findInspirationBrief({db,clickup,product,listId,input,profile}) {
  if(db.supabaseUrl?.replace(/\/$/,'')!==QA_SUPABASE_URL)throw new Error('Brief lookup is restricted to QA.');
  assertQaClickUpList(listId);
  const result=await db.from('inspirations').select('*').eq('product_id',product.id).eq('id',input.inspirationId).maybeSingle();
  const row=result.data;
  if(result.error || !row || row.product_id!==product.id || row.id!==input.inspirationId || row.updated_at!==input.expectedUpdatedAt)throw new Error('Inspiration changed. Reopen it before fetching the brief.');
  let data=row.data || {},taskId=data._sourceClickupId;
  if(data._sourceProductId && data._sourceProductId!==product.id) {
    if(profile?.role!=='admin') {
      if(!profile?.id)throw new Error('Source product access is required.');
      const access=await db.from('user_products').select('product_id').eq('user_id',profile.id).eq('product_id',data._sourceProductId).maybeSingle();
      if(access.error || !access.data)throw new Error('Source product access is required.');
    }
    const sourceProduct=await db.from('products').select('*').eq('id',data._sourceProductId).maybeSingle();
    if(sourceProduct.error || !sourceProduct.data || productClickUpListId(sourceProduct.data)!==listId)throw new Error('Source product is unavailable or is not linked to the QA list.');
    const kind=data._sourceInsId?'inspirations':data._sourceAdId?'ads':'';
    if(!kind)throw new Error('Source identity is missing.');
    const source=await db.from(kind).select('*').eq('product_id',data._sourceProductId).eq('id',data._sourceInsId || data._sourceAdId).maybeSingle();
    if(source.error || !source.data || source.data.deleted_at || source.data.meta?._productBoundaryQuarantined)throw new Error('Source record is unavailable.');
    data=kind==='inspirations'?source.data.data || {}:source.data.meta || {};
    const stored=clickUpDocumentUrl(data._clickupDocPageUrl || data._sourceInspirationBriefUrl);
    if(stored)return {productId:product.id,inspirationId:row.id,version:row.updated_at,url:stored};
    taskId=kind==='inspirations'?data._sourceClickupId:source.data.clickup_task_id || data.clickupTaskId || data._clickupId;
  }
  if(typeof taskId!=='string' || !/^[a-zA-Z0-9_-]+$/.test(taskId))throw new Error('No source ClickUp task is available for brief lookup.');
  const task=await clickup.getTask(listId,taskId);
  const url=findClickUpBrief(task) || findClickUpBrief({},await clickup.comments(listId,taskId));
  if(!url)throw new Error('No brief link found in the source task or its comments.');
  return {productId:product.id,inspirationId:row.id,version:row.updated_at,url};
}

export async function saveInspirationBrief(db,request) {
  if(db.supabaseUrl?.replace(/\/$/,'')!==QA_SUPABASE_URL)throw new Error('Brief saves are restricted to QA.');
  const result=await db.rpc('qa_inspiration_brief',request);
  if(result.error)throw Object.assign(new Error(result.error.message || 'Brief save failed.'),{definite:/^(P0001|22|23|42501)/.test(result.error.code || '')});
  const saved=result.data;
  if(saved?.requestId!==request.p_request_id || saved?.productId!==request.p_product_id || saved?.row?.id!==request.p_id || saved?.row?.product_id!==request.p_product_id || saved?.row?.data?._clickupDocPageUrl!==request.p_url || !saved.row.updated_at || saved.dispatchEnabled!==false)
    throw new Error('Brief save could not be verified. Retry the same request.');
  return saved;
}
