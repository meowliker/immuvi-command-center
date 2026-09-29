import test from 'node:test';
import assert from 'node:assert/strict';
import { runPlanPush, savePlanBatch } from '../../lib/services/action-plan-bulk.js';
const rows = ['a', 'b', 'c'].map((id) => ({ display: { dbId: id, title: id }, actionVersion: '2026-09-18T01:00:00Z' }));

test('bulk save uses selection snapshot versions and the scoped atomic RPC', async () => {
  const db = { rpc: async (name, args) => {
    assert.equal(name, 'qa_plan_batch'); assert.equal(args.p_product_id, 'qa-product');
    assert.equal(args.p_items[0].updated_at, rows[0].actionVersion);
    assert.equal(args.p_value, 'Testing'); return { data: [{ id: 'a' }] };
  } };
  assert.deepEqual(await savePlanBatch(db, 'qa-product', rows.slice(0, 1), 'status', 'Testing'), [{ id: 'a' }]);
  await assert.rejects(savePlanBatch({ rpc: async () => ({ error: { message: 'Stale selection' } }) }, 'p', rows, 'remove'), /Stale selection/);
  await assert.rejects(savePlanBatch({ rpc: async () => ({ data: [] }) }, 'p', rows, 'due', ''), /Incomplete/);
});
test('bulk push is sequential, preserves per-item failures, and never retries a failed create', async () => {
  const calls = [], progress = []; let inflight = 0;
  const result = await runPlanPush(rows, async (row) => {
    assert.equal(inflight++, 0); calls.push(row.display.dbId);
    await new Promise((resolve) => setTimeout(resolve, 2)); inflight--;
    if (row.display.dbId === 'b') throw new Error('Uncertain create');
    return { state: 'pushed', message: 'Pushed' };
  }, { onProgress: (next) => progress.push(next.length) });
  assert.deepEqual(calls, ['a', 'b', 'c']);
  assert.deepEqual(result.map((r) => r.state), ['pushed', 'failed', 'pushed']);
  assert.equal(result[1].message, 'Uncertain create'); assert.deepEqual(progress, [1, 2, 3]);
});
test('stop after current task prevents subsequent external requests', async () => {
  let stopped = false, count = 0;
  const result = await runPlanPush(rows, async () => { count++; stopped = true; return { state: 'pushed', message: 'Pushed' }; }, { shouldStop: () => stopped });
  assert.equal(count, 1); assert.deepEqual(result.map((r) => r.state), ['pushed', 'skipped', 'skipped']);
});
