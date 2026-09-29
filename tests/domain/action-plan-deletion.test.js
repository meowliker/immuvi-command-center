import test from 'node:test';
import assert from 'node:assert/strict';
import { planDeletionTarget, deletedPlanTargets } from '../../lib/domain/action-plan-deletion.js';
const action = () => ({ display: { dbId: 'va:a', isVirtual: true, productId: 'p', linkedAdId: 'a', title: 'Creative', clickupTaskId: 'task' }, payload: { sourceAdId: 'a' }, linkedAdMeta: {}, adVersion: 'v1' });
test('deletion targets the explicit creative, without staging virtual tasks', () => {
  assert.deepEqual(planDeletionTarget('p', action()), { productId: 'p', adId: 'a', title: 'Creative', taskId: 'task', version: 'v1', deletedAt: '' });
  assert.equal(planDeletionTarget('p', { ...action(), display: { ...action().display, dbId: 'saved', isVirtual: false } }).adId, 'a');
});
test('missing, fuzzy, quarantined, foreign and conflicting links are not deletable', () => {
  for (const patch of [{ adVersion: '' }, { payload: {} }, { payload: { sourceAdId: 'other' } }, { linkedAdMeta: { _productBoundaryQuarantined: true } },
    { payload: { sourceAdId: 'a', _clickupId: 'different' } }, { display: { ...action().display, linkedAdId: '' } }]) {
    assert.throws(() => planDeletionTarget('p', { ...action(), ...patch }));
  }
  assert.throws(() => planDeletionTarget('foreign', action()));
});
test('deleted-creative list requires matching product and tombstone identity', () => {
  const ads = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, product_id: 'p', deleted_at: '2026-09-21', clickup_task_id: 'task' }));
  ads[1].product_id = 'other'; ads[2].deleted_at = null; ads[3].meta = { _productBoundaryQuarantined: true };
  const tombstones = ads.map((a) => ({ id: a.id, product_id: 'p', clickup_task_id: a.id === 'e' ? 'other-task' : 'task' }));
  assert.deepEqual(deletedPlanTargets('p', ads, tombstones).map((a) => a.adId), ['a']);
  assert.deepEqual(deletedPlanTargets('p', ads, []), []);
});
