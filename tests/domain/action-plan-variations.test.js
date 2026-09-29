import test from 'node:test';
import assert from 'node:assert/strict';
import { planVariationGroups } from '../../lib/domain/action-plan-variations.js';
import { normalizeActionAd } from '../../lib/domain/action-plan.js';
import { planLifecycleRows } from '../../lib/domain/action-plan-visibility.js';

const ad = (id, parentAdId = '', status = 'Untested', variationNumber = 0) => ({ id, parentAdId, status, variationNumber, productId: 'qa', formatName: id });
const action = (id, source, extra = {}) => ({ display: { dbId: id, productId: 'qa', linkedAdId: source, ...extra }, payload: { sourceAdId: source } });

test('variations group direct children, sort numerically and preserve the legacy all-child denominator', () => {
  const ads = [ad('parent', '', 'Winner'), ad('v10', 'parent', 'Winner', 10), ad('v2', 'parent', 'Scale', 2),
    ad('v3', 'parent', 'Mild Winner', 3), ad('v4', 'parent', 'Testing', 4), ad('grandchild', 'v2', 'Winner', 1)];
  const before = structuredClone(ads);
  const groups = planVariationGroups(ads, [], 'qa');
  assert.deepEqual(groups.map((g) => g.id), ['parent', 'v2']);
  assert.deepEqual(groups[0].rows.map((r) => r.id), ['v2', 'v3', 'v4', 'v10']);
  assert.equal(groups[0].total, 4); assert.equal(groups[0].winners, 2); assert.equal(groups[0].winRate, 50);
  assert.equal(groups[1].winRate, 100); assert.equal(groups[0].winner, true);
  assert.deepEqual(ads, before);
});

test('axis totals count each child once per axis, retain custom names and tolerate malformed metadata', () => {
  const ads = [ad('p'), { ...ad('a', 'p', ' winner '), variationChanges: ['Hook', 'Hook', ' Music ', '__proto__', 3, null, ''] },
    { ...ad('b', 'p'), variationChanges: ['Hook', 'constructor'] }, { ...ad('c', 'p', 'Scale'), variationChanges: 'Hook' }];
  const group = planVariationGroups(ads, [], 'qa')[0];
  assert.equal(group.winRate, 67);
  assert.deepEqual(group.axes.find((a) => a.name === 'Hook'), { name: 'Hook', total: 2, wins: 1 });
  assert.deepEqual(group.axes.find((a) => a.name === '__proto__'), { name: '__proto__', total: 1, wins: 1 });
  assert.deepEqual(group.axes.find((a) => a.name === 'Other'), { name: 'Other', total: 1, wins: 1 });
  assert.equal(group.rows.find((r) => r.id === 'c').axes, '-');
});

test('foreign, deleted, quarantined, orphan and self-parent records never produce misleading groups', () => {
  const ads = [ad('p'), ad('valid', 'p'), ad('orphan', 'missing'), ad('self', 'self'),
    { ...ad('foreign', 'p'), productId: 'other' }, { ...ad('deleted', 'p'), deletedAt: 'now' },
    { ...ad('quarantined', 'p'), _productBoundaryQuarantined: true },
    { ...ad('other-parent'), productId: 'other' }, ad('foreign-parent-child', 'other-parent')];
  assert.deepEqual(planVariationGroups(ads, [], 'qa')[0].rows.map((r) => r.id), ['valid']);
  assert.deepEqual(planVariationGroups(ads, [], 'missing'), []);
  assert.deepEqual(planVariationGroups([ad('p')], [], 'qa'), []);
});

test('task opening requires a unique explicit same-product link and never reveals a personally hidden task', () => {
  const ads = [ad('p'), ad('a', 'p'), ad('b', 'p'), ad('c', 'p'), ad('d', 'p')];
  const actions = [action('A', 'a'), action('B1', 'b'), action('B2', 'b'), action('C', 'c', { productId: 'other' }),
    { ...action('D', 'd'), payload: { title: 'd' } }];
  const rows = planVariationGroups(ads, actions, 'qa')[0].rows;
  assert.deepEqual(rows.map((r) => r.actionId), ['A', '', '', '']);
  const hidden = planVariationGroups(ads, actions, 'qa', new Set(['a']))[0];
  assert.equal(hidden.total, 4); assert.equal(hidden.rows[0].actionId, ''); assert.equal(hidden.rows[0].hidden, true);
});

test('database normalization supplies assignments, due date and safe ClickUp references without writes', () => {
  const raw = [{ id: 'p', product_id: 'qa' }, { id: 'v', product_id: 'qa', parent_ad_id: 'p', variation_number: 4,
    meta: { assignees: [{ id: 12, username: 'Editor One' }], dueDate: '2026-10-10', variationChanges: ['CTA'] } }];
  const ads = raw.map(normalizeActionAd);
  const rows = planVariationGroups(ads, [action('V', 'v', { clickupTaskId: 'task/unsafe?x' })], 'qa')[0].rows;
  assert.equal(rows[0].editor, 'Editor One'); assert.equal(rows[0].dueDate, '2026-10-10');
  assert.equal(rows[0].clickupUrl, 'https://app.clickup.com/t/task%2Funsafe%3Fx');
  const eligible = planLifecycleRows([], raw, [{ id: 'v', product_id: 'qa' }]).ads.map(normalizeActionAd);
  assert.deepEqual(planVariationGroups(eligible, [], 'qa'), []);
});
