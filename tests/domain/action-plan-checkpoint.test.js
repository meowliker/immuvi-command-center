import test from 'node:test';
import assert from 'node:assert/strict';
import { checkpointArguments, checkpointReview, PLAN_TESTING_DECISIONS } from '../../lib/domain/action-plan-checkpoint.js';
const action = { display: { dbId: 'a', linkedAdId: 'ad', productId: 'p', status: 'Testing' }, payload: { adId: 'ad' }, linkedAdMeta: {}, actionVersion: 'v1', adVersion: 'v2' };

test('checkpoint decisions are restricted to linked, versioned product actions', () => {
  for (const decision of [...PLAN_TESTING_DECISIONS, 'snooze']) assert.equal(checkpointArguments('p', action, decision).p_decision, decision);
  assert.throws(() => checkpointArguments('foreign', action, 'Winner'), /Reload/);
  assert.throws(() => checkpointArguments('p', { ...action, payload: {} }, 'Winner'), /Reload/);
  assert.throws(() => checkpointArguments('p', { ...action, adVersion: '' }, 'Winner'), /Reload/);
  assert.throws(() => checkpointArguments('p', action, 'Testing'), /Invalid/);
});
test('only due checkpoints open, and only the first unused checkpoint offers snooze', () => {
  const ad = { testingDeferCount: 0, testingDeferredAt: null };
  assert.deepEqual(checkpointReview(action, { phase: 'first' }, ad), { available: true, canSnooze: true });
  assert.deepEqual(checkpointReview(action, { phase: 'final' }, ad), { available: true, canSnooze: false });
  for (const phase of ['none', 'snoozed']) assert.equal(checkpointReview(action, { phase }, ad).available, false);
  assert.equal(checkpointReview(action, { phase: 'first' }, { ...ad, testingDeferCount: 1 }).canSnooze, false);
  assert.equal(checkpointReview(action, { phase: 'first' }, { ...ad, testingDeferredAt: 123 }).canSnooze, false);
  assert.equal(checkpointReview({ ...action, linkedAdMeta: { _productBoundaryQuarantined: true } }, { phase: 'first' }, ad).available, false);
});
