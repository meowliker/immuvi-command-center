import test from 'node:test';
import assert from 'node:assert/strict';
import { savePlanWorkflow } from '../../lib/services/action-plan-workflow.js';
import { QA_SUPABASE_URL } from '../../lib/qa-supabase-env.js';

const action = { display: { dbId: 'task', productId: 'qa', linkedAdId: 'ad', clickupTaskId: 'remote' }, payload: { sourceAdId: 'ad' }, actionVersion: 'seen-action-version', adVersion: 'seen-ad-version' };
function fixture(data, error = null) {
  const calls = [];
  return { calls, db: { supabaseUrl: QA_SUPABASE_URL, async rpc(name, input) { calls.push({ name, input }); return { data, error }; } } };
}
const saved = () => ({ action: { id: 'task', product_id: 'qa', updated_at: 'saved-action-version', payload: { sourceAdId: 'ad', _clickupId: 'remote' } },
  ad: { id: 'ad', product_id: 'qa', updated_at: 'saved-ad-version', status: 'Testing', clickup_task_id: 'remote', last_status_change_at: 123, meta: { dueDate: '', _dueDateMs: null } } });
test('quick edits send displayed versions without fetching fresh versions and retain the acknowledged versions', async () => {
  const { db, calls } = fixture(saved());
  const result = await savePlanWorkflow(db, 'qa', action, 'status', 'Testing');
  assert.deepEqual(calls[0], { name: 'qa_plan_edit', input: { p_product_id: 'qa', p_action_id: 'task', p_expected_updated_at: 'seen-action-version', p_ad_id: 'ad', p_ad_updated_at: 'seen-ad-version', p_status: 'Testing', p_due_date: null } });
  assert.equal(result.actionVersion, 'saved-action-version'); assert.equal(result.adVersion, 'saved-ad-version'); assert.equal(result.changedAt, 123);
  assert.equal((await savePlanWorkflow(db, 'qa', action, 'due', '')).dueAtMs, null);
});
test('standalone edits use the existing atomic workflow/history transaction', async () => {
  const standalone = { ...action, display: { ...action.display, linkedAdId: '', clickupTaskId: '' }, payload: {}, adVersion: '' };
  const { db, calls } = fixture([{ id: 'task', action: { id: 'task', product_id: 'qa', updated_at: 'new', live_status: 'Testing', payload: { _statusChangedAt: 123 } } }]);
  const result = await savePlanWorkflow(db, 'qa', standalone, 'status', 'Testing');
  assert.equal(calls[0].name, 'qa_plan_batch'); assert.equal(calls[0].input.p_items[0].updated_at, 'seen-action-version'); assert.equal(result.changedAt, 123);
});
test('stale saves and incomplete or mismatched acknowledgements cannot report success', async () => {
  await assert.rejects(savePlanWorkflow(fixture(null, { message: 'Task changed' }).db, 'qa', action, 'status', 'Testing'), /Task changed/);
  for (const mutate of [() => null, () => ({}), (s) => ({ ...s, action: { ...s.action, product_id: 'foreign' } }), (s) => ({ ...s, ad: { ...s.ad, id: 'wrong' } }), (s) => ({ ...s, ad: { ...s.ad, status: 'Winner' } }), (s) => ({ ...s, ad: { ...s.ad, clickup_task_id: 'foreign-task' } }), (s) => ({ ...s, ad: { ...s.ad, deleted_at: 'now' } })]) {
    await assert.rejects(savePlanWorkflow(fixture(mutate(saved())).db, 'qa', action, 'status', 'Testing'), /could not be verified/);
  }
});
test('foreign products, unresolved links, missing versions, invalid values, and non-QA clients cannot send writes', async () => {
  for (const bad of [{ ...action, display: { ...action.display, productId: 'foreign' } }, { ...action, payload: { adId: 'wrong' } }, { ...action, adVersion: '' }, { ...action, display: { ...action.display, linkedAdId: '' }, payload: {} }]) {
    const { db, calls } = fixture(saved()); await assert.rejects(savePlanWorkflow(db, 'qa', bad, 'status', 'Testing')); assert.equal(calls.length, 0);
  }
  for (const [operation, value] of [['due', '2026-02-30'], ['status', 'unknown'], ['unknown', '']]) {
    const { db, calls } = fixture(saved()); await assert.rejects(savePlanWorkflow(db, 'qa', action, operation, value)); assert.equal(calls.length, 0);
  }
  const { db, calls } = fixture(saved()); db.supabaseUrl = 'https://production.invalid';
  await assert.rejects(savePlanWorkflow(db, 'qa', action, 'status', 'Testing'), /restricted to QA/); assert.equal(calls.length, 0);
});
