import test from 'node:test';
import assert from 'node:assert/strict';
import { planLinkedCandidates, planLinkedCacheKey } from '../../lib/domain/action-plan-linked-done.js';

const action = () => ({ display: { status: 'Ready to Launch', clickupTaskId: 'task', linkedAdId: 'ad' }, adVersion: 'v1', payload: { adId: 'ad' }, linkedAdMeta: {} });
test('only explicit current ready-to-launch links become distinct lookup candidates', () => {
  const a = action();
  assert.deepEqual(planLinkedCandidates([a, a]), [{ adId: 'ad', taskId: 'task', version: 'v1' }]);
  for (const patch of [{ status: 'Testing' }, { clickupTaskId: '' }, { linkedAdId: '' }, { clickupTaskDeleted: true }]) {
    assert.deepEqual(planLinkedCandidates([{ ...a, display: { ...a.display, ...patch } }]), []);
  }
  for (const patch of [{ payload: {} }, { adVersion: '' }, { linkedAdMeta: { _productBoundaryQuarantined: true } }]) assert.deepEqual(planLinkedCandidates([{ ...a, ...patch }]), []);
});
test('cache identity separates product, task and source versions', () => {
  const item = planLinkedCandidates([action()])[0];
  const keys = [planLinkedCacheKey('p1', item), planLinkedCacheKey('p2', item), planLinkedCacheKey('p1', { ...item, taskId: 'other' }), planLinkedCacheKey('p1', { ...item, version: 'v2' })];
  assert.equal(new Set(keys).size, 4);
});
