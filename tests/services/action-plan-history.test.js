import test from 'node:test';
import assert from 'node:assert/strict';
import { readPlanHistoryPage } from '../../lib/services/action-plan-history.js';
import historyRows from '../browser/history-fixture.cjs';

const stamp = '2026-09-16T12:00:00.123456+00:00';
function fixture(count = 85) {
  const rows = Array.from({ length: count }, (_, i) => ({ id: String(i).padStart(4, '0'), product_id: 'qa', action_id: 'a', created_at: stamp, event_type: 'status_changed' }));
  const calls = [];
  const db = { from(table) {
    const url = new URL('https://fixture.test'); calls.push({ table, url });
    return { select(value) { url.searchParams.set('select', value); return this; }, eq(key, value) { url.searchParams.set(key, value); return this; }, order() { return this; }, limit(value) { url.searchParams.set('limit', value); return this; }, or(value) { url.searchParams.set('or', `(${value})`); return this; },
      async abortSignal() { return { data: historyRows(rows.filter((r) => r.product_id === url.searchParams.get('product_id')), url) }; } };
  } };
  return { rows, calls, db };
}
test('keyset pagination covers more than 40 tied timestamps exactly once and preserves timestamp precision', async () => {
  const f = fixture(), ids = []; let cursor = null, more = true;
  while (more) { const page = await readPlanHistoryPage(f.db, 'qa', { actionId: 'a', taskId: '', adId: '' }, cursor); ids.push(...page.rows.map((row) => row.id)); cursor = page.cursor; more = page.hasMore; }
  assert.equal(ids.length, 85); assert.equal(new Set(ids).size, 85); assert.equal(cursor.created_at, stamp);
  assert.equal(f.calls.length, 3); assert.ok(f.calls.every(({ url }) => url.searchParams.get('product_id') === 'qa' && url.searchParams.get('limit') === '41'));
});
test('task identity OR is grouped with the cursor AND and never widens product scope', async () => {
  const f = fixture(0);
  for (const [id, patch] of [['a', { action_id: 'action' }], ['b', { clickup_task_id: 'task' }], ['c', { metadata: { ad_id: 'ad' } }], ['d', { action_id: 'other' }], ['e', { product_id: 'foreign', action_id: 'action' }]]) f.rows.push({ id, product_id: 'qa', created_at: stamp, ...patch });
  const result = await readPlanHistoryPage(f.db, 'qa', { actionId: 'action', taskId: 'task', adId: 'ad' }, { id: 'c', created_at: stamp });
  assert.deepEqual(result.rows.map((r) => r.id), ['b', 'a']);
  assert.equal((await readPlanHistoryPage(f.db, 'qa')).rows.length, 4);
});
test('query literal escaping handles punctuation without permitting filter injection', async () => {
  const f = fixture(0), id = 'ad,"\\),or(product_id.eq.foreign)';
  f.rows.push({ id: 'event', product_id: 'qa', created_at: stamp, metadata: { ad_id: id } });
  assert.equal((await readPlanHistoryPage(f.db, 'qa', { actionId: 'a', taskId: '', adId: id })).rows.length, 1);
  await assert.rejects(readPlanHistoryPage(f.db, '', null), /product/);
  await assert.rejects(readPlanHistoryPage(f.db, 'qa', { actionId: '', taskId: '', adId: '' }), /target/);
  await assert.rejects(readPlanHistoryPage(f.db, 'qa', null, { id: 'a', created_at: 'bad' }), /cursor/);
});
test('concurrent inserts do not shift subsequent keyset pages', async () => {
  const f = fixture(45), first = await readPlanHistoryPage(f.db, 'qa');
  f.rows.push({ ...f.rows[0], id: 'new', created_at: '2026-09-17T00:00:00Z' });
  const second = await readPlanHistoryPage(f.db, 'qa', null, first.cursor);
  assert.equal(second.rows.length, 5); assert.equal(new Set([...first.rows, ...second.rows].map((r) => r.id)).size, 45);
});
test('virtual task history uses creative/task identity without sending a synthetic UUID to Postgres', async () => {
  const f = fixture(0);
  f.rows.push({ id: 'event', product_id: 'qa', created_at: stamp, metadata: { ad_id: 'ad' } });
  const result = await readPlanHistoryPage(f.db, 'qa', { actionId: '', taskId: '', adId: 'ad' });
  assert.equal(result.rows.length, 1);
  assert.equal(f.calls[0].url.searchParams.get('or').includes('action_id.eq'), false);
});
test('foreign, malformed, duplicate, failed and cancelled responses do not become history', async () => {
  for (const data of [null, [{ id: 'e', product_id: 'foreign', created_at: stamp }], [{ id: 'e', product_id: 'qa', created_at: 'bad' }], Array(2).fill({ id: 'e', product_id: 'qa', created_at: stamp })]) {
    const f = fixture(), from = f.db.from; f.db.from = (table) => { const q = from(table); q.abortSignal = async () => ({ data }); return q; };
    await assert.rejects(readPlanHistoryPage(f.db, 'qa'));
  }
  const f = fixture(), from = f.db.from; f.db.from = (table) => { const q = from(table); q.abortSignal = async () => ({ error: {} }); return q; };
  await assert.rejects(readPlanHistoryPage(f.db, 'qa'), /Could not load/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(readPlanHistoryPage(fixture().db, 'qa', null, null, controller.signal), { name: 'AbortError' });
});
