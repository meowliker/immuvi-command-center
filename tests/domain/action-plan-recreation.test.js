import test from 'node:test';
import assert from 'node:assert/strict';
import { planRecreationTarget } from '../../lib/domain/action-plan-recreation.js';
const action = { display: { dbId: 'action', linkedAdId: 'ad', productId: 'p', clickupTaskId: 'task', title: 'Title' }, payload: { sourceAdId: 'ad', _clickupTaskDeleted: true }, linkedAdMeta: {}, adVersion: 'ad-version', actionVersion: 'act-version' };
test('repair requires explicit scoped versioned links, but accepts deleted-remote anomalies', () => {
  assert.equal(planRecreationTarget('p', action).taskId, 'task');
  for (const patch of [{ actionVersion: '' }, { adVersion: '' }, { payload: {} }, { display: { ...action.display, clickupTaskId: '' } }]) assert.throws(() => planRecreationTarget('p', { ...action, ...patch }));
  assert.throws(() => planRecreationTarget('other', action));
});
test('virtual repair passes no synthetic UUID and no fake action version', () => {
  const result = planRecreationTarget('p', { ...action, display: { ...action.display, dbId: 'va:ad', isVirtual: true }, actionVersion: '' });
  assert.equal(result.actionId, null); assert.equal(result.actionVersion, null);
});
