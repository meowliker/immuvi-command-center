import test from 'node:test';
import assert from 'node:assert/strict';
import { readPlanLinkedDone } from '../../lib/services/action-plan-linked-done.js';
import { runClickUpIntegration } from '../../lib/services/clickup-integration.js';
import { QA_CLICKUP_LIST_ID as listId } from '../../lib/domain/clickup-sync.js';

function fixture() {
  const reads = [], calls = [], ads = [{ id: 'a', product_id: 'qa', status: 'Ready to Launch', clickup_task_id: 'source', updated_at: 'v1', meta: {} }], deleted = [];
  const tasks = { source: { id: 'source', list: { id: listId }, linked_tasks: [{ link_id: 'source' }, { link_id: 'production' }, { link_id: 'ignored' }] }, production: { id: 'production', list: { id: listId }, date_done: '1789556400000' } };
  const db = { from(table) { return { select() { return this; }, eq(key, value) { reads.push([table, key, value]); return this; }, in() { return this; }, order() { return this; }, range() { return this; }, async abortSignal() { return { data: table === 'ads' ? ads : deleted }; } }; } };
  const clickup = { async getTask(list, id) { assert.equal(list, listId); calls.push(id); if (tasks[id] instanceof Error) throw tasks[id]; return tasks[id]; } };
  return { db, clickup, product: { id: 'qa' }, listId, input: { adIds: ['a'] }, ads, deleted, tasks, reads, calls };
}
test('linked completion uses first non-self link, scopes reads and preserves source version', async () => {
  const f = fixture();
  assert.deepEqual(await readPlanLinkedDone(f), { rows: [{ adId: 'a', taskId: 'source', version: 'v1', doneAt: 1789556400000, error: '' }], throttled: false });
  assert.deepEqual(f.calls, ['source', 'production']);
  assert.deepEqual(f.reads, [['ads', 'product_id', 'qa'], ['deleted_ads', 'product_id', 'qa']]);
});
test('integration allows member reads without write RPCs and still enforces the QA list', async () => {
  const f = fixture(); f.product.config = { clickup_list_id: listId };
  const input = { ...f.input, operation: 'plan-linked-done' };
  assert.equal((await runClickUpIntegration({ ...f, input, profile: { role: 'member' } })).rows[0].doneAt, 1789556400000);
  f.product.config.clickup_list_id = 'foreign'; f.calls.length = 0;
  await assert.rejects(runClickUpIntegration({ ...f, input, profile: { role: 'member' } })); assert.deepEqual(f.calls, []);
});
test('failed local reads and mismatched source tasks cannot supply completion dates', async () => {
  for (const table of ['ads', 'deleted_ads']) {
    const f = fixture(), from = f.db.from;
    f.db.from = (name) => { const query = from(name); if (name === table) query.abortSignal = async () => ({ error: { message: 'failed' } }); return query; };
    await assert.rejects(readPlanLinkedDone(f)); assert.deepEqual(f.calls, []);
  }
  for (const patch of [{ id: 'wrong' }, { list: { id: 'foreign' } }]) {
    const f = fixture(); Object.assign(f.tasks.source, patch);
    const row = (await readPlanLinkedDone(f)).rows[0]; assert.ok(row.error); assert.equal(row.doneAt, null); assert.deepEqual(f.calls, ['source']);
  }
});
test('rejects foreign lists and invalid batches before any reads', async () => {
  for (const input of [{ adIds: [] }, { adIds: ['a', 'a'] }, { adIds: [null] }, { adIds: Array.from({ length: 21 }, (_, i) => String(i)) }]) {
    const f = fixture(); await assert.rejects(readPlanLinkedDone({ ...f, input })); assert.deepEqual(f.reads, []);
  }
  const f = fixture(); await assert.rejects(readPlanLinkedDone({ ...f, listId: 'foreign' })); assert.deepEqual(f.reads, []);
});
test('metadata fallbacks match dashboard normalization and metadata-deleted creatives stay unavailable', async () => {
  const f = fixture(); Object.assign(f.ads[0], { status: '', clickup_task_id: '', meta: { status: 'Ready to Launch', clickupTaskId: 'source', _clickupId: 'obsolete' } });
  assert.equal((await readPlanLinkedDone(f)).rows[0].doneAt, 1789556400000);
  f.calls.length = 0; f.ads[0].meta.deletedAt = 'deleted';
  assert.ok((await readPlanLinkedDone(f)).rows[0].error); assert.deepEqual(f.calls, []);
});
test('deleted, quarantined, foreign, missing and wrong-status creatives never reach ClickUp', async () => {
  for (const patch of [{ deleted_at: 'now' }, { meta: { _productBoundaryQuarantined: true } }, { product_id: 'foreign' }, { status: 'Testing' }, { clickup_task_id: '' }]) {
    const f = fixture(); Object.assign(f.ads[0], patch);
    assert.ok((await readPlanLinkedDone(f)).rows[0].error); assert.deepEqual(f.calls, []);
  }
  for (const tombstone of [{ id: 'a' }, { clickup_task_id: 'source' }]) {
    const f = fixture(); f.deleted.push(tombstone); assert.ok((await readPlanLinkedDone(f)).rows[0].error); assert.deepEqual(f.calls, []);
  }
});
test('no links or unfinished links are negative results, malformed or foreign responses are errors', async () => {
  const f = fixture(); f.tasks.source.linked_tasks = [];
  assert.equal((await readPlanLinkedDone(f)).rows[0].doneAt, null);
  for (const date_done of [null, '', 0, '0']) {
    const f = fixture(); f.tasks.production.date_done = date_done;
    assert.deepEqual((await readPlanLinkedDone(f)).rows[0], { adId: 'a', taskId: 'source', version: 'v1', doneAt: null, error: '' });
  }
  for (const patch of [{ date_done: 'invalid' }, { date_done: -1 }, { date_done: 1e100 }, { id: 'wrong' }, { list: { id: 'foreign' } }]) {
    const f = fixture(); Object.assign(f.tasks.production, patch); const row = (await readPlanLinkedDone(f)).rows[0]; assert.ok(row.error); assert.equal(row.doneAt, null);
  }
  delete f.tasks.source.linked_tasks; assert.ok((await readPlanLinkedDone(f)).rows[0].error);
});
test('individual failures do not lose later results; throttling stops further remote reads', async () => {
  for (const throttled of [false, true]) {
    const f = fixture(); f.ads.push({ ...f.ads[0], id: 'b', clickup_task_id: 'next' }); f.input.adIds.push('b');
    f.tasks.source = Object.assign(new Error('unavailable'), { status: throttled ? 429 : 500 });
    f.tasks.next = { id: 'next', list: { id: listId }, linked_tasks: [] };
    const result = await readPlanLinkedDone(f); assert.equal(result.throttled, throttled); assert.equal(result.rows.length, 2);
    assert.equal(Boolean(result.rows[1].error), throttled); assert.deepEqual(f.calls, throttled ? ['source'] : ['source', 'next']);
  }
});
test('cancellation propagates without becoming a cached fallback', async () => {
  const f = fixture(), controller = new AbortController(); controller.abort();
  await assert.rejects(readPlanLinkedDone({ ...f, signal: controller.signal }), { name: 'AbortError' }); assert.deepEqual(f.calls, []);
  const active = fixture(), next = new AbortController();
  active.clickup.getTask = async () => { next.abort(); return active.tasks.source; };
  await assert.rejects(readPlanLinkedDone({ ...active, signal: next.signal }), { name: 'AbortError' });
});
