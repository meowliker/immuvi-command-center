import { QA_SUPABASE_URL } from '../qa-supabase-env.js';
import { explicitPlanSource } from '../domain/action-plan-editing.js';
import { planBatchItems } from '../domain/action-plan-workspace.js';

function qa(db) { if (db.supabaseUrl?.replace(/\/$/,'')!==QA_SUPABASE_URL) throw new Error('Production changes are restricted to QA.'); }
function verifyRows(saved, productId, adId, actionId) {
  const { ad, action }=saved || {};
  if (!action?.id || (actionId && action.id!==actionId) || action.product_id!==productId || !action.updated_at || !action.payload
    || (adId ? ad?.id!==adId : ad!=null) || (ad && (ad.product_id!==productId || !ad.updated_at || ad.deleted_at || ad.meta?._productBoundaryQuarantined))
    || (action.payload.sourceAdId || action.payload.adId || action.payload._sourceAdId || '')!==(adId || '')) throw new Error('Save could not be verified. Refresh before retrying.');
  return saved;
}

export async function createProduction(db, request) {
  qa(db);
  const result=await db.rpc('qa_production_intake',request);
  if(result.error)throw Object.assign(new Error(result.error.message || 'Could not create production task.'),{definite:/^(P0001|22|23|42501)/.test(result.error.code || '')});
  const saved=result.data;
  verifyRows(saved,request.p_product_id,saved?.ad?.id,'');
  if(!saved.ad?.id || saved.requestId!==request.p_request_id || saved.productId!==request.p_product_id || saved.ad.status!=='Untested'
    || Object.entries(request.p_values).some(([key,value])=>key==='format' ? saved.action.payload.format!==value : key==='meta' ? Object.entries(value).some(([field,v])=>saved.ad.meta?.[field]!==v) : saved.ad[key]!==value))
    throw new Error('Creation could not be verified. Retry this same request.');
  return saved;
}

export async function editProduction(db,productId,action,kind,values) {
  qa(db);
  const item=planBatchItems([action])[0];
  if(action.display.productId!==productId || explicitPlanSource(action)!==(item.ad_id || ''))throw new Error('Task source is unresolved.');
  if(!['details','fields','format'].includes(kind))throw new Error('Unsupported production edit.');
  if(kind==='format' && (typeof values.format!=='string' || values.format.length>500))throw new Error('Format must be at most 500 characters.');
  const result=await db.rpc(kind==='format'?'qa_production_format':kind==='details'?'qa_plan_creative':'qa_plan_fields',{
    p_product_id:productId,p_action_id:item.id,p_expected_updated_at:item.updated_at,p_ad_id:item.ad_id || null,p_ad_updated_at:item.ad_updated_at || null,
    [kind==='format'?'p_format':kind==='details'?'p_values':'p_custom']:kind==='format'?values.format:values,
  });
  if(result.error)throw new Error(result.error.message || 'Could not save task.');
  const saved=verifyRows(result.data,productId,item.ad_id,item.id),ad=saved.ad;
  const remote=ad?.clickup_task_id || ad?.meta?._clickupId || ad?.meta?.clickupTaskId || '';
  if(remote!==(action.display.clickupTaskId || '') || (saved.action.payload._clickupId || saved.action.payload.clickupTaskId || remote)!==remote)
    throw new Error('Task link changed. Refresh before retrying.');
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const mismatched=Object.entries(values).some(([key,value])=>kind==='format' ? saved.action.payload.format!==value : kind==='fields'
    ? !equal(ad?.meta?._customFieldsRaw?.[value.name.toLowerCase()],value.value)
    : key==='meta' ? Object.entries(value).some(([field,v])=>!equal(ad?.meta?.[field],v)) : !equal(ad ? ad[key] : saved.action.payload.title,value));
  if(mismatched)throw new Error('Saved fields could not be verified. Refresh before retrying.');
  return saved;
}
