import { QA_SUPABASE_URL } from '../qa-supabase-env.js';
import { promotionArguments } from '../domain/action-plan-adoption.js';
import { normalizeManualActionRow, resolveActionDisplay } from '../domain/action-plan.js';

export async function promotePlanAction(db, productId, action) {
  if (!action.display.isVirtual) return action;
  if (db.supabaseUrl?.replace(/\/$/, '') !== QA_SUPABASE_URL) throw new Error('Task promotion is restricted to QA.');
  const args = promotionArguments(productId, action);
  const result = await db.rpc('qa_plan_stage', args);
  if (result.error) throw new Error(result.error.message || 'Could not save this adopted task.');
  const row = result.data, p = row?.payload;
  const source = p?.sourceAdId || p?.adId || p?._sourceAdId;
  const task = p?._clickupId || p?.clickupTaskId || '';
  if (!row?.id || String(row.id).startsWith('va:') || row.product_id !== productId || !row.updated_at
    || source !== action.display.linkedAdId || task !== (action.display.clickupTaskId || '') || p?._virtual) {
    throw new Error('Task promotion could not be verified. Refresh before retrying.');
  }
  const persisted = resolveActionDisplay(normalizeManualActionRow(row), []);
  return { ...action, display: { ...action.display, id: persisted.id, dbId: persisted.dbId, isVirtual: false }, payload: p, actionVersion: row.updated_at };
}

// Explicit removal must not reappear as a virtual row. Read only removal events,
// page through all of them, and fail closed if their identities are unavailable.
export async function readRemovedPlanIds(db, productId, signal) {
  const ids = new Set();
  const seen = new Set();
  for (let offset = 0; ; offset += 500) {
    const result = await db.from('activity_events').select('id,product_id,metadata')
      .eq('product_id', productId).eq('event_type', 'removed_from_plan').order('id').range(offset, offset + 499).abortSignal(signal);
    signal?.throwIfAborted();
    if (result.error || !Array.isArray(result.data) || result.data.some((row) => row.product_id !== productId || !row.id)) {
      throw new Error('Could not verify removed tasks. Refresh before adopting tasks.');
    }
    for (const row of result.data) {
      if (seen.has(row.id)) throw new Error('Removed-task pagination did not advance. Refresh before adopting tasks.');
      seen.add(row.id);
      const id = row.metadata?.linked_ad_id || row.metadata?.ad_id;
      if (typeof id === 'string' && id) ids.add(JSON.stringify([productId, id]));
    }
    if (result.data.length < 500) return ids;
  }
}
