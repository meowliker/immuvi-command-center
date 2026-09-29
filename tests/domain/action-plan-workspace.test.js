import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPlanActions, sortPlanActions, planBatchItems } from '../../lib/domain/action-plan-workspace.js';
const row = (id, values = {}) => ({ display: { dbId: id, title: id, status: 'Untested', source: { kind: 'blank' }, ...values }, actionVersion: '2026-09-18T01:00:00Z' });

test('Action Plan filters combine search, taxonomy, funnel, source, status and due criteria', () => {
  const a = row('a', { title: 'Energy story', angle: 'Energy', persona: 'Busy people', funnelStage: 'TOF', dueDate: '2026-09-01' });
  const b = row('b', { title: 'Energy winner', status: 'Winner', dueDate: '2026-09-01' });
  assert.deepEqual(filterPlanActions([a, b], { query: ' ENERGY ', angle: 'Energy', persona: 'Busy people', funnelStage: 'TOF', source: 'blank', due: 'overdue' }, Date.parse('2026-09-18')), [a]);
  assert.deepEqual(filterPlanActions([a, b], { bucket: 'winners' }), [b]);
  assert.deepEqual(filterPlanActions([a, b], { status: 'Testing' }), []);
  assert.deepEqual(filterPlanActions([a, b, row('c')], { due: 'none' }), [row('c')]);
});
test('Action Plan sorting never mutates input and keeps missing values last in both directions', () => {
  const rows = [row('none'), row('later', { dueDate: '2026-10-02' }), row('earlier', { dueDate: '2026-10-01' })];
  assert.deepEqual(sortPlanActions(rows, 'dueDate', 1).map((a) => a.display.dbId), ['earlier', 'later', 'none']);
  assert.deepEqual(sortPlanActions(rows, 'dueDate', -1).map((a) => a.display.dbId), ['later', 'earlier', 'none']);
  assert.equal(rows[0].display.dbId, 'none');
});
test('Action Plan bulk snapshots require versions, bounded selection, and unique identities', () => {
  const a = row('a', { linkedAdId: 'ad-a' }); a.adVersion = '2026-09-18T02:00:00Z';
  assert.deepEqual(planBatchItems([a]), [{ id: 'a', updated_at: a.actionVersion, ad_id: 'ad-a', ad_updated_at: a.adVersion }]);
  assert.throws(() => planBatchItems([]), /Select between/);
  assert.throws(() => planBatchItems(Array.from({ length: 101 }, (_, i) => row(String(i)))), /Select between/);
  assert.throws(() => planBatchItems([a, a]), /Duplicate/);
  assert.throws(() => planBatchItems([a, { ...a, display: { ...a.display, dbId: 'other' } }]), /Duplicate/);
  assert.throws(() => planBatchItems([{ ...a, adVersion: '' }]), /versions/);
});
