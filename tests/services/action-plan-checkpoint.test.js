import test from 'node:test';
import assert from 'node:assert/strict';
import { savePlanCheckpoint } from '../../lib/services/action-plan-checkpoint.js';
const action = { display: { dbId: 'a', linkedAdId: 'ad', productId: 'p', status: 'Testing' }, payload: { adId: 'ad' }, actionVersion: 'old-action', adVersion: 'old-ad' };
const data = { ad: { id: 'ad', clickup_task_id: 'task' }, action: { id: 'a' } };
test('checkpoint save uses the opened snapshot; snooze never pushes to ClickUp', async () => {
  let calls = 0;
  const db = { rpc: async (name, input) => {
    assert.equal(name, 'qa_plan_checkpoint'); assert.equal(input.p_expected_updated_at, 'old-action'); assert.equal(input.p_ad_updated_at, 'old-ad');
    return { data };
  } };
  const saved = await savePlanCheckpoint(db, 'p', action, 'snooze', async () => { calls++; });
  assert.match(saved.message, /snoozed/); assert.equal(calls, 0);
});
test('rejected checkpoint does not make remote writes', async () => {
  let calls = 0;
  await assert.rejects(savePlanCheckpoint({ rpc: async () => ({ error: { message: 'Creative changed' } }) }, 'p', action, 'Winner', async () => { calls++; }), /Creative changed/);
  assert.equal(calls, 0);
});
test('local decision is retained if remote push fails or partly fails', async () => {
  const db = { rpc: async () => ({ data }) };
  for (const push of [async () => { throw new Error('Offline'); }, async () => ({ failed: [{ field: 'status', error: 'Rejected' }] })]) {
    const result = await savePlanCheckpoint(db, 'p', action, 'Winner', push);
    assert.equal(result.ad, data.ad); assert.match(result.message, /saved in QA.*ClickUp pending/);
  }
});
test('explicit local-only decision skips push; successful push uses returned source IDs', async () => {
  const db = { rpc: async () => ({ data }) };
  assert.doesNotMatch((await savePlanCheckpoint(db, 'p', action, 'Loser', null)).message, /ClickUp/);
  const result = await savePlanCheckpoint(db, 'p', action, 'Scale', async (input) => {
    assert.deepEqual(input, { operation: 'push-creative', adId: 'ad', actionId: 'a' }); return { failed: [] };
  });
  assert.match(result.message, /ClickUp updated/);
});
