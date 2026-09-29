import test from 'node:test';
import assert from 'node:assert/strict';
import { savedPlanCount } from '../../lib/domain/action-plan-count.js';
import { summarizeActionPlan } from '../../lib/domain/action-plan.js';

const action = (id, payload = {}, product_id = 'qa') => ({ id, product_id, payload });
const ad = (id, fields = {}) => ({ id, product_id: 'qa', ...fields });

test('navigation counts saved records, including personally hidden tasks, not adoptable creatives or filters', () => {
  const actions = [action('saved', { adId: 'creative' }), action('standalone')];
  const ads = [ad('creative'), ad('not-in-plan')];
  const before = structuredClone({ actions, ads });
  assert.equal(savedPlanCount(actions, ads, [], 'qa'), 2);
  assert.equal(savedPlanCount([], ads, [], 'qa'), 0);
  assert.deepEqual({ actions, ads }, before);
});

test('navigation count applies action and creative lifecycle guards, including remote-identity tombstones', () => {
  const actions = [action('ok'), action('q', { _productBoundaryQuarantined: true }), action('d', { deletedAt: 'deleted' }),
    action('ad-d', { sourceAdId: 'deleted' }), action('ad-q', { adId: 'quarantined' }), action('ad-t', { clickupTaskId: 'remote-tombstone' })];
  assert.equal(savedPlanCount(actions, [ad('deleted', { deleted_at: 'deleted' }), ad('quarantined', { meta: { _productBoundaryQuarantined: true } })],
    [ad('tombstone', { clickup_task_id: 'remote-tombstone' })], 'qa'), 1);
});

test('count isolates products before applying colliding tombstones and deduplicates persisted IDs', () => {
  const rows = [action('same', { adId: 'creative' }), action('same'), action('foreign', {}, 'other'), action('')];
  assert.equal(savedPlanCount(rows, [ad('creative')], [ad('creative', { product_id: 'other' })], 'qa'), 1);
  assert.equal(savedPlanCount(rows, [], [], ''), 0);
});

test('header overdue totals follow local midnight and omit terminal tasks', () => {
  const tasks = [{ status: 'Testing', dueDate: '2026-09-22' }, { status: 'Winner', dueDate: '2026-09-21' }];
  assert.equal(summarizeActionPlan(tasks, new Date(2026, 8, 22, 23, 59).getTime()).overdue, 0);
  assert.equal(summarizeActionPlan(tasks, new Date(2026, 8, 23, 0, 1).getTime()).overdue, 1);
  assert.equal(summarizeActionPlan(tasks, new Date(2026, 8, 23).getTime()).total, 2);
});
