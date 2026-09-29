import test from 'node:test';
import assert from 'node:assert/strict';
import { promotePlanAction, readRemovedPlanIds } from '../../lib/services/action-plan-adoption.js';
import { virtualPlanActions } from '../../lib/domain/action-plan-adoption.js';
const action = () => virtualPlanActions([], [], [{ id: 'ad', product_id: 'p', format_name: 'Task', status: 'Testing', clickup_task_id: 'cu', updated_at: 'version', meta: {} }])[0];
const row = () => ({ id: 'persisted', product_id: 'p', updated_at: 'version2', payload: { sourceAdId: 'ad', _clickupId: 'cu' } });

test('promotion calls only the existing version-checked staging RPC and replaces virtual DB identity', async () => {
  const calls = [], source = action();
  const db = { supabaseUrl: 'https://entgcnlfsnysnwyadzzp.supabase.co', rpc: async (...args) => { calls.push(args); return { data: row() }; } };
  const saved = await promotePlanAction(db, 'p', source);
  assert.equal(saved.display.dbId, 'persisted'); assert.equal(saved.display.isVirtual, false); assert.equal(saved.actionVersion, 'version2');
  assert.equal(saved.adVersion, 'version'); assert.equal(source.display.isVirtual, true);
  assert.deepEqual(calls, [['qa_plan_stage', { p_product_id: 'p', p_ad_id: 'ad', p_expected_updated_at: 'version' }]]);
  assert.equal(await promotePlanAction(db, 'p', saved), saved); assert.equal(calls.length, 1);
});

test('stale/error/foreign/unverified stage responses fail without a blind retry or subsequent mutation', async () => {
  for (const response of [{ error: { message: 'Creative changed' } }, { data: null }, { data: { ...row(), product_id: 'other' } }, { data: { ...row(), payload: { sourceAdId: 'wrong', _clickupId: 'cu' } } }, { data: { ...row(), payload: { sourceAdId: 'ad', _clickupId: 'wrong' } } }]) {
    let calls = 0;
    const db = { supabaseUrl: 'https://entgcnlfsnysnwyadzzp.supabase.co', rpc: async () => { calls++; return response; } };
    await assert.rejects(promotePlanAction(db, 'p', action())); assert.equal(calls, 1);
  }
  await assert.rejects(promotePlanAction({ supabaseUrl: 'https://hdniumnkprkadlrrataz.supabase.co' }, 'p', action()), /restricted/);
});

function removalDb(pages) {
  const calls = [];
  return { calls, from(table) {
    assert.equal(table, 'activity_events'); const filters = {}; let offset;
    return { select() { return this; }, eq(key, value) { filters[key] = value; return this; }, order() { return this; }, range(from) { offset = from; return this; },
      async abortSignal() { calls.push({ filters, offset }); return { data: pages[offset / 500] }; } };
  } };
}
test('all removal events are paginated and product scoped without a fixed total cap', async () => {
  const records = Array.from({ length: 501 }, (_, id) => ({ id: `e${id}`, product_id: 'p', metadata: { linked_ad_id: `ad${id}` } }));
  const db = removalDb([records.slice(0, 500), records.slice(500)]);
  const removed = await readRemovedPlanIds(db, 'p'); assert.equal(removed.size, 501);
  assert.ok(removed.has(JSON.stringify(['p', 'ad500'])));
  assert.deepEqual(db.calls.map((c) => c.offset), [0, 500]);
  assert.ok(db.calls.every((c) => c.filters.event_type === 'removed_from_plan' && c.filters.product_id === 'p'));
});
test('invalid removal snapshots and repeated pages fail closed rather than resurrecting tasks or looping', async () => {
  for (const page of [null, [{ id: 'event', product_id: 'other' }]]) await assert.rejects(readRemovedPlanIds(removalDb([page]), 'p'));
  const page = Array.from({ length: 500 }, (_, id) => ({ id: `e${id}`, product_id: 'p' }));
  await assert.rejects(readRemovedPlanIds(removalDb([page, page]), 'p'), /did not advance/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(readRemovedPlanIds(removalDb([[]]), 'p', controller.signal), { name: 'AbortError' });
});
