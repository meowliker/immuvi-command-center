import type { SupabaseClient } from '@supabase/supabase-js';
import { inspirationRequest } from '../../../lib/domain/inspiration-editing.js';
import { mutateInspiration } from '../../../lib/services/inspiration-mutations.js';
import { requestQaClickUp } from './qa-clickup';
import { queuePrivateInspiration } from './queue-private-inspiration';

export async function saveInspiration(db:SupabaseClient, request:ReturnType<typeof inspirationRequest>) {
  const result=await mutateInspiration(db,request),failed:string[]=[];
  if(request.p_operation==='create' && 'mode' in request.p_values && request.p_values.mode==='url') {
    try {
      // Reuse the creation request identity if the save acknowledgement was lost.
      const queued=await queuePrivateInspiration(db,{productId:request.p_product_id,inspirationId:result.id,requestId:request.p_request_id});
      return queued.status==='done'?'Inspiration already processed.':queued.status==='running'
        ?`Inspiration is classifying on ${queued.workerName}.`:`Inspiration queued on ${queued.workerName}.`;
    } catch(error) {
      // Creation succeeded. Do not invite a second URL submission after a dispatch failure.
      return `Inspiration saved. ${error instanceof Error?error.message:'Could not confirm worker dispatch.'} Check Activity; use Process All with Codex to retry the existing inspiration.`;
    }
  }
  for(const id of result.remoteAdIds) {
    try { const pushed=await requestQaClickUp(db,request.p_product_id,{operation:'push-creative',adId:id});if(pushed.failed?.length)failed.push(id); }
    catch { failed.push(id); }
  }
  let sourceNotice='';
  if(Object.hasOwn(request.p_values.fields,'adType') && result.row?.data?._sourceClickupId) {
    try {
      const synced=await requestQaClickUp(db,request.p_product_id,{operation:'sync-inspiration-type',inspirationId:result.id,expectedUpdatedAt:result.row.updated_at});
      if(!synced.synced || synced.inspirationId!==result.id || synced.productId!==request.p_product_id || synced.version!==result.row.updated_at || synced.taskId!==result.row.data._sourceClickupId || synced.adType!==result.row.data.adType)throw new Error('Unverified source sync.');
      sourceNotice=' Source ad type verified in the QA ClickUp task.';
    }catch { sourceNotice=' Source-task ad type is not confirmed in ClickUp. Use Sync source ad type to retry.'; }
  }
  return (result.queue?.worker_assignment==='blocked:qa-isolation'?'Inspiration saved. Use Process All with Codex to dispatch it to your private worker.'
    :failed.length?`Saved in QA. ${failed.length} linked ClickUp updates remain pending in Creative Tracker.`:'Inspiration saved.')+sourceNotice;
}
