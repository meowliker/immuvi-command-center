import test from 'node:test';
import assert from 'node:assert/strict';
import { deletePlanCreative } from '../../lib/services/action-plan-deletion.js';
import { deletePlanRemoteTask } from '../../lib/services/action-plan-remote-deletion.js';
const url = 'https://entgcnlfsnysnwyadzzp.supabase.co';
const target = { productId: 'p', adId: 'a', taskId: 'task', title: 'Name', version: 'v1', deletedAt: '' };
test('local deletion calls the existing QA transaction once and verifies its acknowledgment', async () => {
  const calls = [], db = { supabaseUrl: url, rpc: async (...args) => { calls.push(args); return { data: { id: 'a', product_id: 'p', clickup_task_id: 'task', deleted_at: 'stamp' } }; } };
  assert.equal((await deletePlanCreative(db, 'p', target)).deletedAt, 'stamp');
  assert.deepEqual(calls, [['qa_tracker_delete', { p_product_id: 'p', p_ad_id: 'a', p_expected_updated_at: 'v1' }]]);
  await assert.rejects(deletePlanCreative({ ...db, supabaseUrl: 'https://production.invalid' }, 'p', target), /restricted/);
  await assert.rejects(deletePlanCreative(db, 'other', target), /Reopen/);
  assert.equal(calls.length, 1);
});
test('failed and uncertain local deletes are not blindly retried', async () => {
  for (const result of [{ error: { message: 'Creative changed' } }, { data: null }, { data: { id: 'other', product_id: 'p', deleted_at: 'stamp' } },
    { data: { id: 'a', product_id: 'p', deleted_at: 'stamp', clickup_task_id: 'different' } }]) {
    let calls = 0;
    await assert.rejects(deletePlanCreative({ supabaseUrl: url, rpc: async () => { calls++; return result; } }, 'p', target));
    assert.equal(calls, 1);
  }
});
function remoteFixture() {
  const data = { ads: [{ id: 'a', product_id: 'p', clickup_task_id: 'task', deleted_at: 'stamp' }],
    deleted_ads: [{ id: 'a', product_id: 'p', clickup_task_id: 'task' }], manual_actions: [], qa_clickup_creations: [] };
  const calls = [], reads = [];
  const db = { from(table) {
    const filters = {}; let from = 0, to = 499;
    const rows = () => data[table].filter((row) => Object.entries(filters).every(([key, value]) => row[key] === value));
    return { select() { return this; }, eq(key, value) { filters[key] = value; return this; }, order() { return this; }, range(a, b) { from = a; to = b; return this; },
      async maybeSingle() { reads.push({ table, filters }); return { data: rows()[0] || null }; },
      async abortSignal() { reads.push({ table, filters }); return { data: rows().slice(from, to + 1) }; } };
  } };
  const args = { db, clickup: { deleteTask: async (...args) => { calls.push(args); } }, product: { id: 'p' }, listId: '1301130000002447', input: { adId: 'a', taskId: 'task' } };
  return { data, calls, reads, args, run: () => deletePlanRemoteTask(args) };
}
test('remote deletion checks the tombstone, active references and creation locks before the list-verified delete', async () => {
  const f = remoteFixture(); assert.deepEqual(await f.run(), { deleted: true, adId: 'a', taskId: 'task' });
  assert.deepEqual(f.calls, [['1301130000002447', 'task']]);
  assert.ok(f.reads.every((r) => r.filters.product_id === 'p'));
});
test('remote deletion rejects stale IDs, absent tombstones, live references, quarantine and unresolved creation', async () => {
  for (const mutate of [
    (f) => { f.args.input.taskId = 'other'; }, (f) => { f.data.ads[0].deleted_at = null; },
    (f) => { f.data.deleted_ads = []; }, (f) => { f.data.deleted_ads[0].clickup_task_id = 'different'; },
    (f) => { f.data.ads[0].meta = { _productBoundaryQuarantined: true }; },
    (f) => { f.data.ads.push({ id: 'b', product_id: 'p', meta: { _clickupId: 'task' } }); },
    (f) => { f.data.manual_actions.push({ id: 'ma', product_id: 'p', payload: { clickupTaskId: 'task' } }); },
    (f) => { f.data.qa_clickup_creations.push({ id: 'job', product_id: 'p', ad_id: 'a', state: 'uncertain' }); },
    (f) => { f.args.listId = 'production-list'; },
  ]) {
    const f = remoteFixture(); mutate(f); await assert.rejects(f.run()); assert.deepEqual(f.calls, []);
  }
});
test('remote deletion checks references beyond the first page and propagates abort/network failures', async () => {
  const f = remoteFixture();
  f.data.manual_actions = Array.from({ length: 501 }, (_, i) => ({ id: `m${i}`, product_id: 'p', payload: i === 500 ? { _clickupId: 'task' } : {} }));
  await assert.rejects(f.run(), /active record/); assert.equal(f.calls.length, 0);
  f.data.manual_actions = [];
  const controller = new AbortController(); controller.abort(); f.args.signal = controller.signal;
  await assert.rejects(f.run(), { name: 'AbortError' }); assert.equal(f.calls.length, 0);
  delete f.args.signal;
  let tries = 0; f.args.clickup.deleteTask = async () => { tries++; throw new Error('Network uncertain'); };
  await assert.rejects(f.run(), /Network uncertain/); assert.equal(tries, 1);
});
