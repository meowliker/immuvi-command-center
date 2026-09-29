import test from 'node:test';
import assert from 'node:assert/strict';
import { planHiddenIds, setPlanHidden, planHiddenCount, planLifecycleRows } from '../../lib/domain/action-plan-visibility.js';
import { filterPlanActions, PLAN_FILTERS } from '../../lib/domain/action-plan-workspace.js';

test('hidden preferences normalize safely and change only the requested creative identity', () => {
  assert.deepEqual(planHiddenIds(null), []);
  const saved = ['other-product', 'a', 'a'];
  assert.deepEqual(setPlanHidden(saved, 'b', true), ['other-product', 'a', 'b']);
  assert.deepEqual(setPlanHidden(saved, 'a', false), ['other-product']);
  assert.deepEqual(saved, ['other-product', 'a', 'a']);
  for (const value of [{}, 'a', [null], ['']]) assert.throws(() => planHiddenIds(value), /invalid/);
  assert.throws(() => setPlanHidden([], '', true), /identity/);
});

test('hidden tasks are excluded by default; show hidden composes with filters and counts distinct current creatives', () => {
  const row = (id, ad) => ({ display: { dbId: id, title: id, linkedAdId: ad, status: 'Testing', source: {} } });
  const rows = [row('a', 'ad'), row('b', 'ad'), row('standalone', ''), row('c', 'other')], hidden = new Set(['ad', 'foreign']);
  const filter = (patch) => filterPlanActions(rows, { ...PLAN_FILTERS, ...patch }, Date.now(), new Map(), hidden).map((a) => a.display.dbId);
  assert.deepEqual(filter({}), ['standalone', 'c']);
  assert.deepEqual(filter({ showHidden: true }), ['a', 'b', 'standalone', 'c']);
  assert.deepEqual(filter({ showHidden: true, query: 'a', status: ['Winner'] }), []);
  assert.deepEqual(filter({ showHidden: true, query: 'standalone' }), ['standalone']);
  assert.equal(planHiddenCount(rows, hidden), 1);
});

test('deleted and quarantined creative identities suppress stale actions before title fallback', () => {
  const ads = [
    { id: 'gone', product_id: 'p', deleted_at: 'stamp', clickup_task_id: 'cu-gone' },
    { id: 'legacy', product_id: 'p', meta: { deletedAt: 'stamp' } },
    { id: 'blocked', product_id: 'p', meta: { _productBoundaryQuarantined: true, _clickupId: 'cu-blocked' } },
    { id: 'valid', product_id: 'p' },
  ];
  const actions = ['gone', 'legacy', 'blocked', 'valid'].map((id) => ({ id, product_id: 'p', payload: { adId: id, title: 'Same title' } }));
  actions.push({ id: 'by-task', product_id: 'p', payload: { _clickupId: 'cu-gone' } });
  const snapshot = structuredClone({ ads, actions });
  const result = planLifecycleRows(actions, ads);
  assert.deepEqual(result.actions.map((r) => r.id), ['valid']); assert.deepEqual(result.ads.map((r) => r.id), ['valid']);
  assert.deepEqual({ ads, actions }, snapshot);
});

test('tombstones apply by creative and ClickUp identity within the same product, not by title', () => {
  const tombstones = [{ product_id: 'p', id: 'gone', clickup_task_id: 'cu' }];
  const ads = [{ id: 'reimport', product_id: 'p', meta: { clickupTaskId: 'cu' } }, { id: 'gone', product_id: 'foreign' }];
  const actions = [
    { id: 'gone', product_id: 'p', payload: { sourceAdId: 'gone' } },
    { id: 'task', product_id: 'p', payload: { clickupTaskId: 'cu' } },
    { id: 'standalone', product_id: 'p', payload: { title: 'gone' } },
    { id: 'foreign', product_id: 'foreign', payload: { adId: 'gone' } },
  ];
  const result = planLifecycleRows(actions, ads, tombstones);
  assert.deepEqual(result.actions.map((r) => r.id), ['standalone', 'foreign']);
  assert.deepEqual(result.ads, [ads[1]]);
});

test('remote task deletion remains visible as an anomaly while action deletion/quarantine cannot reappear', () => {
  const actions = [
    { id: 'remote', payload: { _clickupTaskDeleted: true } },
    { id: 'deleted', deleted_at: 'stamp' },
    { id: 'quarantine', payload: { _productBoundaryQuarantined: true } },
  ];
  assert.deepEqual(planLifecycleRows(actions, []).actions, [actions[0]]);
});
