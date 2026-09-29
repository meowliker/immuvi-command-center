import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewOneScaleLaunch } from '../../lib/services/action-plan-onescale.js';
import { runClickUpIntegration } from '../../lib/services/clickup-integration.js';
const listId = '1301130000002447';
function fixture() {
  const f = { product: { id: 'qa', config: { clickup_list_id: listId } }, listId,
    input: { operation: 'review-onescale', targets: [{ adId: 'ad', adVersion: 'av', actionId: 'action', actionVersion: 'mv', taskId: 'task' }] },
    data: { ads: [{ id: 'ad', product_id: 'qa', format_name: 'Creative', status: 'Ready to Launch', updated_at: 'av', clickup_task_id: 'task', meta: {} }],
      manual_actions: [{ id: 'action', product_id: 'qa', updated_at: 'mv', live_status: 'Ready to Launch', payload: { sourceAdId: 'ad', _clickupId: 'task' } }],
      deleted_ads: [], qa_clickup_creations: [] }, reads: [], remoteReads: [],
    remote: { id: 'task', list: { id: listId }, status: { status: 'ready to launch' } } };
  f.db = { from(table) { return { select() { return this; }, eq(key, value) { assert.equal(key, 'product_id'); assert.equal(value, 'qa'); return this; },
    order() { return this; }, range(start, end) { this.start = start; this.end = end; return this; }, async abortSignal() {
      f.reads.push({ table, from: this.start });
      return table === f.failTable ? { error: { message: 'failed' } } : { data: structuredClone(f.data[table].slice(this.start, this.end + 1)) };
    } }; } };
  f.clickup = { async getTask(list, id) { assert.equal(list, listId); f.remoteReads.push(id); if (f.remoteError) throw f.remoteError; return structuredClone(f.remote); } };
  f.run = () => reviewOneScaleLaunch(f);
  return f;
}
test('authenticated integration operation verifies readiness but never supplies a launch URL or writes', async () => {
  const f = fixture(), before = structuredClone(f.data);
  const result = await runClickUpIntegration(f);
  assert.equal(result.externalLaunchEnabled, false); assert.match(result.blockedReason, /no isolated test environment/);
  assert.deepEqual(result.tasks, [{ adId: 'ad', taskId: 'task', title: 'Creative' }]);
  assert.equal(result.url, undefined); assert.equal(result.callbackUrl, undefined); assert.equal(result.productId, 'qa');
  assert.deepEqual(f.data, before); assert.deepEqual(f.remoteReads, ['task']);
});
test('all local guards fail before remote reads', async () => {
  for (const mutate of [(f) => f.data.ads[0].product_id = 'foreign', (f) => f.data.ads[0].updated_at = 'changed',
    (f) => f.data.ads[0].deleted_at = 'deleted', (f) => f.data.ads[0].status = 'Testing', (f) => f.data.ads[0].meta._clickupTaskDeleted = true,
    (f) => f.data.manual_actions[0].payload._productBoundaryQuarantined = true, (f) => f.data.manual_actions[0].payload.adId = 'wrong',
    (f) => f.data.manual_actions[0].payload._clickupId = 'wrong', (f) => f.data.manual_actions[0].live_status = 'Testing',
    (f) => f.data.manual_actions[0].updated_at = 'changed', (f) => f.data.deleted_ads.push({ id: 'gone', product_id: 'qa', clickup_task_id: 'task' }),
    (f) => f.data.qa_clickup_creations.push({ product_id: 'qa', ad_id: 'ad', state: 'uncertain' }),
    (f) => f.data.ads.push({ ...f.data.ads[0], id: 'other' }), (f) => f.failTable = 'deleted_ads']) {
    const f = fixture(); mutate(f); await assert.rejects(f.run()); assert.deepEqual(f.remoteReads, []);
  }
});
test('remote failure, missing task, wrong list or identity, archived and non-ready tasks do not pass review', async () => {
  for (const mutate of [(f) => f.remoteError = Object.assign(new Error('missing'), { status: 404 }), (f) => f.remoteError = new Error('timeout'),
    (f) => f.remote.id = 'other', (f) => f.remote.list.id = 'production', (f) => f.remote.status.status = 'testing', (f) => f.remote.archived = true]) {
    const f = fixture(); mutate(f); const before = structuredClone(f.data); await assert.rejects(f.run()); assert.deepEqual(f.data, before);
  }
});
test('virtual review does not stage an action and rejects a concurrently saved action', async () => {
  const f = fixture(); f.input.targets[0].actionId = null; f.input.targets[0].actionVersion = null;
  await assert.rejects(f.run(), /Action Plan changed/); f.data.manual_actions = [];
  assert.equal((await f.run()).tasks.length, 1); assert.deepEqual(f.data.manual_actions, []);
});
test('pagination detects conflicting task ownership beyond the first page', async () => {
  const f = fixture(); f.data.ads.push(...Array.from({ length: 500 }, (_, i) => ({ id: `extra-${i}`, product_id: 'qa' })));
  f.data.ads.at(-1).clickup_task_id = 'task'; await assert.rejects(f.run(), /Another creative/);
  assert.ok(f.reads.some((r) => r.table === 'ads' && r.from === 500)); assert.deepEqual(f.remoteReads, []);
});
test('production list and cancelled requests never read remote tasks', async () => {
  const f = fixture(); f.listId = 'production'; await assert.rejects(f.run()); assert.deepEqual(f.reads, []);
  const g = fixture(); g.signal = AbortSignal.abort(); await assert.rejects(g.run()); assert.deepEqual(g.remoteReads, []);
});
