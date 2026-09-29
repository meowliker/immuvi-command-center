import { QA_SUPABASE_URL } from '../qa-supabase-env.js';

export async function deletePlanCreative(db, productId, target) {
  if (db.supabaseUrl?.replace(/\/$/, '') !== QA_SUPABASE_URL) throw new Error('Creative deletion is restricted to QA.');
  if (target.productId !== productId || !target.adId || !target.version || target.deletedAt) throw new Error('Reopen the creative before deleting.');
  const result = await db.rpc('qa_tracker_delete', { p_product_id: productId, p_ad_id: target.adId, p_expected_updated_at: target.version });
  if (result.error) throw new Error(result.error.message || 'Could not delete the creative.');
  const ad = result.data;
  const taskId = ad?.clickup_task_id || ad?.meta?._clickupId || ad?.meta?.clickupTaskId || '';
  if (ad?.id !== target.adId || ad?.product_id !== productId || !ad?.deleted_at || taskId !== target.taskId) {
    throw new Error('Deletion could not be verified. Refresh before retrying; no ClickUp deletion was sent.');
  }
  return { ...target, deletedAt: ad.deleted_at };
}
