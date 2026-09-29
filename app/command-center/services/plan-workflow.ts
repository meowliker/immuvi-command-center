import type { SupabaseClient } from '@supabase/supabase-js';
import { trackerRpc } from './tracker';
import { requestQaClickUp } from './qa-clickup';

export type CreationJob = { id:string; ad_id:string; state:'sending'|'uncertain'|'rejected'|'created'|'linked'; last_error:string | null };
export const creationLocked = (job?:CreationJob) => !!job && !['linked','rejected'].includes(job.state);

export async function addCreativeToPlan(db:SupabaseClient, productId:string, adId:string, version:string) {
  return trackerRpc(db,'qa_plan_stage',{ p_product_id:productId,p_ad_id:adId,p_expected_updated_at:version });
}
export async function pushPlanCreative(db:SupabaseClient, productId:string, adId:string, recoveryTaskId?:string, actionId?:string) {
  const result = await requestQaClickUp(db,productId,{ operation:'create-plan-task',adId,actionId,recoveryTaskId:recoveryTaskId?.trim() || undefined });
  return `Linked to ClickUp task ${result.taskId}.`;
}
