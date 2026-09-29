import { randomUUID } from 'node:crypto';
import { buildCreationPayload, matchesCreation } from '../domain/clickup-creation.js';
import { verifyClickUpCreation } from './verify-clickup-creation.js';

export async function creationMediaKind(db, productId, ad) {
  if(!['AI Style','UGC','VSL','Carousel'].includes(ad.ad_type))return '';
  const own=ad.meta?.mediaKind || ad.meta?.media_kind;
  if(['video','image','photo','carousel'].includes(own))return own;
  const id=ad.meta?._fromInspoId || ad.meta?._sourceInsId;
  if(!id)return '';
  const result=await db.from('inspirations').select('id,product_id,data').eq('product_id',productId).eq('id',id).maybeSingle();
  if(result.error)throw new Error('Could not verify the inspiration media type. Nothing was sent.');
  const row=result.data;
  if(!row || row.id!==id || row.product_id!==productId || row.deleted_at)return '';
  return row.data?.mediaKind || row.data?.media_kind || '';
}

export async function runClickUpCreation({ db, clickup, product, listId, input }) {
  async function rpc(name,args) {
    const result = await db.rpc(name,{ p_product_id:product.id,...args });
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }
  const source = await db.from('ads').select('*').eq('product_id',product.id).eq('id',input.adId).maybeSingle();
  if (source.error || !source.data || source.data.deleted_at) throw new Error('Creative is unavailable.');
  const ad = source.data;
  if (input.actionId) {
    const selected = await db.from('manual_actions').select('*').eq('product_id',product.id).eq('id',input.actionId).maybeSingle();
    const payload=selected.data?.payload;
    if (selected.error || !payload || (payload.sourceAdId || payload.adId || payload._sourceAdId)!==ad.id) throw new Error('Action Plan source identity is unresolved. Relink it before pushing.');
  }
  const action = await rpc('qa_plan_stage',{ p_ad_id:ad.id,p_expected_updated_at:ad.updated_at });
  const lookup = await db.from('qa_clickup_creations').select('*').eq('product_id',product.id).eq('ad_id',ad.id).maybeSingle();
  if (lookup.error) throw new Error('Could not read ClickUp creation history. Nothing was sent.');
  let job = lookup.data;
  const existingTaskId=ad.clickup_task_id || ad.meta?._clickupId || ad.meta?.clickupTaskId;
  if (existingTaskId) { await clickup.getTask(listId,existingTaskId); return { state:'linked',taskId:existingTaskId }; }
  const fresh = !job || job.state === 'rejected';
  const id = job?.id || randomUUID(), token = randomUUID();
  const payload = fresh ? buildCreationPayload({ ad,action,product,schema:await clickup.inspect(listId),jobId:id,mediaKind:await creationMediaKind(db,product.id,ad) }) : null;
  job = await rpc('qa_creation_claim',{ p_ad_id:ad.id,p_job_id:id,p_token:token,p_expected_updated_at:ad.updated_at,
    p_product_updated_at:product.updated_at,p_action_updated_at:action.updated_at,p_payload:payload });
  return completeClaimedCreation({ db, clickup, product, input, job, token });
}

// Both first creation and recreation enter here only after a durable claim.
export async function completeClaimedCreation({ db, clickup, product, input, job, token }) {
  const id = job.id, listId = job.list_id;
  async function rpc(name, args) {
    const result = await db.rpc(name, { p_product_id: product.id, ...args });
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }
  if (job.state === 'linked') return { state:'linked',taskId:job.remote_task_id };
  if (job.state === 'sending') {
    let task;
    try { task = await clickup.createTask(listId,job.payload); }
    catch (error) {
      // Only explicit validation/auth/not-found rejections are safe to retry.
      // Timeouts, 5xx, malformed success responses, and lost connections are ambiguous.
      const state = [400,401,403,404,422].includes(error.status) ? 'rejected' : 'uncertain';
      await rpc('qa_creation_record',{ p_job_id:id,p_token:token,p_state:state,p_remote_task_id:null,
        p_error:state === 'rejected' ? 'ClickUp rejected the create request. Correct the fields or key, then retry.' : 'Creation outcome is uncertain. Recover the existing task before sending again.' });
      throw new Error(state === 'rejected' ? 'ClickUp rejected creation. Correct the fields or key and retry.' : 'ClickUp may have created the task. Use Recover ClickUp link; no second create will be sent.');
    }
    try { job = await rpc('qa_creation_record',{ p_job_id:id,p_token:token,p_state:'created',p_remote_task_id:task.id,p_error:null }); }
    catch { throw new Error(`ClickUp created task ${task.id}, but QA could not record its link. Wait two minutes, then recover the link; do not create another task.`); }
  } else if (!job.remote_task_id) {
    const tasks = input.recoveryTaskId ? [await clickup.getTask(listId,input.recoveryTaskId)] : await clickup.tasks(listId,{ includeArchived:true });
    const matches = tasks.filter((task) => matchesCreation(task,job));
    if (matches.length !== 1) {
      await rpc('qa_creation_record',{ p_job_id:id,p_token:token,p_state:'uncertain',p_remote_task_id:null,
        p_error:matches.length ? 'Multiple marked tasks found. Resolve duplicates in the QA list.' : 'No matching task is visible yet. Check the QA list, then recover again. No new task was sent.' });
      throw new Error(matches.length ? 'Multiple matching ClickUp tasks found. Resolve duplicates before recovering.' : 'No matching task is visible yet. Check the QA list and recover again. Nothing was recreated.');
    }
    job = await rpc('qa_creation_record',{ p_job_id:id,p_token:token,p_state:'created',p_remote_task_id:String(matches[0].id),p_error:null });
  }
  try {
    await verifyClickUpCreation(clickup,job);
    await rpc('qa_creation_finish',{ p_job_id:id,p_token:token });
  } catch (error) {
    try { await rpc('qa_creation_record',{ p_job_id:id,p_token:token,p_state:'created',p_remote_task_id:job.remote_task_id,
      p_error:'The task exists; field confirmation or local linking is incomplete. Recover its link to resume.' }); } catch { /* Keep the original failure; a committed finalize may have lost its response. */ }
    throw error;
  }
  return { state:'linked',taskId:job.remote_task_id };
}
