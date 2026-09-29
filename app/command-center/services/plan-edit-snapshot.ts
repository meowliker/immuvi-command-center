import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActionRecord } from '../types';
import { buildActionRecords } from '../helpers/actions';
import { rebasePlanEdit } from '../../../lib/domain/plan-edit-patches.js';

export async function readPlanEditSnapshot(db: SupabaseClient, productId: string, expected: ActionRecord, edit: unknown): Promise<ActionRecord> {
  if (expected.display.productId !== productId) throw new Error('Task is outside the active product.');
  const [action, ad] = await Promise.all([
    db.from('manual_actions').select('*').eq('product_id', productId).eq('id', expected.display.dbId).maybeSingle(),
    expected.display.linkedAdId
      ? db.from('ads').select('*').eq('product_id', productId).eq('id', expected.display.linkedAdId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (action.error || ad.error || !action.data || (expected.display.linkedAdId && (!ad.data || ad.data.deleted_at || ad.data.meta?._productBoundaryQuarantined))) {
    throw new Error('Task is no longer available for editing. Refresh before retrying.');
  }
  const taskId = ad.data?.clickup_task_id || ad.data?.meta?._clickupId || ad.data?.meta?.clickupTaskId || '';
  const actionTaskId = action.data.payload?._clickupId || action.data.payload?.clickupTaskId || '';
  if (taskId !== (expected.display.clickupTaskId || '') || (actionTaskId && actionTaskId !== taskId)) {
    throw new Error('Task identity changed. Refresh before editing.');
  }
  return rebasePlanEdit(expected, buildActionRecords([action.data], ad.data ? [ad.data] : [])[0], edit);
}
