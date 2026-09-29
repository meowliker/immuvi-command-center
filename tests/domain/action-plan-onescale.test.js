import test from 'node:test';
import assert from 'node:assert/strict';
import { oneScaleTargets, validateOneScaleTargets, readyToLaunch } from '../../lib/domain/action-plan-onescale.js';
const action = () => ({ display: { productId: 'qa', dbId: 'action', linkedAdId: 'ad', clickupTaskId: 'task', status: 'Ready to Launch' },
  payload: { sourceAdId: 'ad', _clickupId: 'task' }, linkedAdMeta: { _clickupId: 'task' }, adVersion: 'av', actionVersion: 'mv' });
test('OneScale targets use explicit identities and snapshot versions, not names or store metadata', () => {
  const a = action(); a.payload.storeId = 'production-store';
  assert.deepEqual(oneScaleTargets('qa', [a]), [{ adId: 'ad', taskId: 'task', adVersion: 'av', actionId: 'action', actionVersion: 'mv' }]);
  assert.equal(readyToLaunch(' ready TO launch '), true); assert.equal(readyToLaunch('Testing'), false);
});
test('virtual launch review stays read-only without a synthetic database ID', () => {
  const a = action(); a.display.isVirtual = true; a.display.dbId = 'va:ad';
  assert.equal(oneScaleTargets('qa', [a])[0].actionId, null); assert.equal(oneScaleTargets('qa', [a])[0].actionVersion, null);
});
test('foreign, stale, deleted, quarantined, fuzzy and conflicting launch identities are rejected', () => {
  for (const mutate of [(a) => a.display.productId = 'foreign', (a) => a.display.status = 'Testing', (a) => delete a.payload.sourceAdId,
    (a) => a.adVersion = '', (a) => a.actionVersion = '', (a) => a.payload._clickupId = 'different',
    (a) => a.linkedAdMeta._clickupTaskDeleted = true, (a) => a.payload._productBoundaryQuarantined = true,
    (a) => a.display.clickupTaskId = 'not/a/task']) {
    const a = action(); mutate(a); assert.throws(() => oneScaleTargets('qa', [a]));
  }
});
test('launch review batches reject missing, excessive and duplicated targets', () => {
  const target = oneScaleTargets('qa', [action()])[0];
  for (const targets of [null, [], [null], [target, target], Array(51).fill(target), [{ ...target, actionId: null }], [{ ...target, taskId: 42 }]]) {
    assert.throws(() => validateOneScaleTargets(targets));
  }
});
