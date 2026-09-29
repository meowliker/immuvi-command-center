import test from 'node:test';
import assert from 'node:assert/strict';
import { planHealth, planRowAge } from '../../lib/domain/action-plan-health.js';
import { sortPlanActions } from '../../lib/domain/action-plan-workspace.js';
import { normalizePlanColumns, normalizePlanViews, namedPlanView } from '../../lib/domain/action-plan-views.js';

const now = Date.parse('2026-09-16T12:00:00Z'), day = 86_400_000;
test('age sorting uses exact elapsed time, with missing values last in both directions and stable ties', () => {
  const rows = ['older', 'younger', 'zero', 'missing', 'tie', 'invalid'].map((id) => ({ display: { dbId: id } }));
  const ages = new Map([
    ['older', planRowAge({ status: 'QA' }, now - 3.2 * day, null, now)],
    ['younger', planRowAge({ status: 'QA' }, now - 3.1 * day, null, now)],
    ['tie', planRowAge({ status: 'QA' }, now - 3.1 * day, null, now)],
    ['zero', planRowAge({ status: 'QA' }, now + day, null, now)],
    ['invalid', { elapsedMs: NaN }],
  ]);
  assert.equal(ages.get('older').label, ages.get('younger').label);
  assert.deepEqual(sortPlanActions(rows, 'age', 1, ages).map((r) => r.display.dbId), ['zero', 'tie', 'younger', 'older', 'invalid', 'missing']);
  assert.deepEqual(sortPlanActions(rows, 'age', -1, ages).map((r) => r.display.dbId), ['older', 'tie', 'younger', 'zero', 'invalid', 'missing']);
  assert.equal(rows[0].display.dbId, 'older');
});
test('checkpoint, snoozed, terminal, and fallback ages retain numeric duration independent of badge labels', () => {
  for (const [status, days, deferred] of [['Testing', 8, null], ['Testing', 15, null], ['Testing', 20, now - day], ['Winner', 30, null]]) {
    assert.equal(planRowAge({ status }, now - days * day, deferred, now).elapsedMs, days * day);
  }
  assert.equal(planRowAge({ updatedAt: now - day }, null, null, now).elapsedMs, day);
  assert.equal(planRowAge({}, null, null, now).elapsedMs, null);
});
test('age sorting consumes the same linked-production correction as the badge', () => {
  const ad = { id: 'ad', productId: 'p', status: 'Ready to Launch', createdAt: now - 40 * day, lastStatusChangeAt: now - 20 * day };
  const rows = [{ display: { dbId: 'linked', linkedAdId: 'ad', productId: 'p', status: ad.status }, payload: {} }, { display: { dbId: 'manual', status: 'QA', lastStatusChangeAt: now - 2 * day }, payload: {} }];
  const health = planHealth(rows, [ad], now, [], {}, new Map([['ad', now - day]]));
  assert.deepEqual(sortPlanActions(health.actions, 'age', -1, health.ages).map((r) => r.display.dbId), ['manual', 'linked']);
});
test('new, existing, and legacy saved layouts retain the age column without losing explicit preferences', () => {
  const fresh = normalizePlanColumns([]);
  assert.deepEqual(fresh.slice(0, 6).map((c) => c.key), ['cb', 'source', 'title', 'angle', 'persona', 'origin']);
  assert.equal(fresh[fresh.findIndex(c => c.key === 'status') + 1].key, 'age');
  const old = [{ key: 'title', width: 300, hidden: false }, { key: 'status', width: 180, hidden: false }];
  const normalized = normalizePlanColumns(old);
  assert.deepEqual(normalized.filter(c => !['angle', 'persona'].includes(c.key)).slice(0, 2), old); assert.equal(normalized.find((c) => c.key === 'age').hidden, false);
  const saved = normalizePlanViews({ views: [{ id: 'old', name: 'Legacy', columns: [{ key: 'age', width: 230, hidden: true }, ...old] }], activeViewId: 'old' });
  const columns = saved.views.find((v) => v.id === 'old').columns;
  assert.deepEqual(columns[0], { key: 'age', width: 230, hidden: true });
  const copy = namedPlanView(saved, columns, 'Age review', 'new');
  assert.deepEqual(normalizePlanViews(copy).views.find((v) => v.id === 'new').columns[0], columns[0]);
  assert.equal(normalizePlanColumns([{ key: 'age', width: 1 }])[0].width, 80);
});
