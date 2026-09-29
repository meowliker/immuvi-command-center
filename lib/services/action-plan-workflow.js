import { QA_SUPABASE_URL } from '../qa-supabase-env.js';
import { explicitPlanSource } from '../domain/action-plan-editing.js';
import { planBatchItems } from '../domain/action-plan-workspace.js';
import { localPlanDay } from '../domain/action-plan-dates.js';

// Use the versions the user saw, not a pre-save refresh that blesses stale edits.
export async function savePlanWorkflow(db, productId, action, operation, value) {
  if (db.supabaseUrl?.replace(/\/$/, '') !== QA_SUPABASE_URL) throw new Error('Workflow changes are restricted to QA.');
  if (action.display.productId !== productId) throw new Error('Task is outside the active product.');
  const item = planBatchItems([action])[0], linked = item.ad_id;
  if (explicitPlanSource(action) !== (linked || '') || (!linked && action.display.clickupTaskId)) throw new Error('Link this task to its creative before editing.');
  if (!['status', 'due'].includes(operation)) throw new Error('Unsupported workflow change.');
  if (operation === 'due' && (typeof value !== 'string' || (value && !localPlanDay(value)))) throw new Error('Enter a valid due date.');
  if (operation === 'status' && !['Untested', 'Approved', 'Assigned', 'To Do', 'In Production', 'Ready to Launch', 'Testing', 'Winner', 'Mild Winner', 'Scale', 'Complete', 'Loser', 'Killed'].includes(value)) throw new Error('Invalid workflow status.');
  const result = linked ? await db.rpc('qa_plan_edit', { p_product_id: productId, p_action_id: item.id,
    p_expected_updated_at: item.updated_at, p_ad_id: linked, p_ad_updated_at: item.ad_updated_at,
    p_status: operation === 'status' ? value : null, p_due_date: operation === 'due' ? value : null })
    : await db.rpc('qa_plan_batch', { p_product_id: productId, p_items: [item], p_operation: operation, p_value: value });
  if (result.error) throw new Error(result.error.message || 'Could not save this workflow change.');
  const saved = linked ? result.data : Array.isArray(result.data) && result.data.length === 1 ? result.data[0] : null;
  const row = saved?.action, ad = saved?.ad;
  const source = row?.payload?.sourceAdId || row?.payload?.adId || row?.payload?._sourceAdId || '';
  const task = ad?.clickup_task_id || ad?.meta?._clickupId || ad?.meta?.clickupTaskId || '';
  const actionTask = row?.payload?._clickupId || row?.payload?.clickupTaskId || '';
  const status = linked ? ad?.status : row?.live_status;
  const due = linked ? ad?.meta?.dueDate : row?.payload?.dueDate;
  if (row?.id !== item.id || row?.product_id !== productId || !row?.updated_at || !row?.payload || source !== (linked || '')
    || (linked && (ad?.id !== linked || ad?.product_id !== productId || !ad?.updated_at || ad?.deleted_at || ad?.meta?._productBoundaryQuarantined))
    || task !== (action.display.clickupTaskId || '') || (actionTask && actionTask !== task)
    || (operation === 'status' ? status !== value : due !== value)) {
    throw new Error('Save could not be verified. Refresh before retrying; no ClickUp update was sent.');
  }
  return { payload: row.payload, linkedAdMeta: ad?.meta || {}, actionVersion: row.updated_at,
    adVersion: ad?.updated_at, changedAt: ad?.last_status_change_at ?? row.payload._statusChangedAt,
    dueAtMs: (ad?.meta || row.payload)._dueDateMs ?? null, linkedAdId: linked || '', taskId: task };
}
