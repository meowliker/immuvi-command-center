import test from 'node:test';
import assert from 'node:assert/strict';
import { planAnomalies, planFacetValues, planFacetOptions, togglePlanFacet } from '../../lib/domain/action-plan-filters.js';
import { PLAN_FILTERS, filterPlanActions } from '../../lib/domain/action-plan-workspace.js';
import { togglePlanPulse } from '../../lib/domain/action-plan-pulse.js';

const now = Date.parse('2026-09-19T12:00:00Z'), day = 86400000;
const row = (id, status, values = {}) => ({ display: { dbId: id, id, title: id, status, source: { kind: 'blank' }, ...values }, payload: {}, linkedAdMeta: {} });
const ids = (rows, filters, ages) => filterPlanActions(rows, { ...PLAN_FILTERS, ...filters }, now, ages).map((r) => r.display.dbId);

test('facets use OR within each category and AND across categories with case-insensitive status only', () => {
  const rows = [row('a', 'Testing', { adType: 'Video', funnelStage: 'TOF', angle: 'Energy' }), row('b', 'Winner', { adType: 'Image', funnelStage: 'MOF', angle: 'Energy' }), row('c', 'Testing', { adType: 'Video', funnelStage: 'BOF', angle: 'energy' })];
  assert.deepEqual(ids(rows, { status: ['testing', 'WINNER'], adType: ['Video', 'Image'], funnelStage: ['TOF', 'MOF'], angle: ['Energy'] }), ['a', 'b']);
  assert.deepEqual(ids(rows, { status: ['winner'], adType: ['Video'] }), []);
  assert.deepEqual(ids(rows, { source: ['tracker', 'inspiration'] }), []);
  assert.deepEqual(ids(rows, {}), ['a', 'b', 'c']);
});

test('facet selections deduplicate, retain missing values, accept prior scalar criteria and do not mutate inputs', () => {
  const rows = [row('a', 'Testing'), row('b', 'TESTING'), row('c', '')];
  const snapshot = structuredClone(rows), selected = ['testing', 'Deleted value'];
  assert.deepEqual(planFacetOptions(rows, selected, 'status'), ['Deleted value', 'testing']);
  assert.deepEqual(planFacetValues(['Testing', 'TESTING', null, {}, ''], 'status'), ['Testing']);
  assert.deepEqual(ids(rows, { status: 'testing' }), ['a', 'b']);
  assert.deepEqual(ids(rows, { status: ['Deleted value'] }), []);
  assert.deepEqual(rows, snapshot); assert.deepEqual(selected, ['testing', 'Deleted value']);
});

test('manual status and pulse replace each other while other facet toggles preserve pulse and date state', () => {
  const pulse = togglePlanPulse(PLAN_FILTERS, 'today:launched');
  const facet = togglePlanFacet(pulse, 'adType', 'Video');
  assert.deepEqual(facet.pulseKeys, ['today:launched']);
  const status = togglePlanFacet(facet, 'status', 'Testing');
  assert.deepEqual(status.pulseKeys, []); assert.deepEqual(status.status, ['Testing']);
  assert.equal(status.datePreset, 'today');
  assert.deepEqual(togglePlanFacet(status, 'status', 'TESTING').status, []);
  assert.deepEqual(togglePlanPulse(status, 'today:briefed').status, []);
  assert.deepEqual(togglePlanPulse(status, 'today:briefed').adType, ['Video']);
  assert.equal(togglePlanFacet(status, '__proto__', 'x'), status);
  assert.deepEqual(PLAN_FILTERS.status, []);
});

test('anomalies flag deletion, tag-removal and recent relinks, not automatic inclusion', () => {
  const action = row('a', 'Testing', { linkedAdId: 'ad' });
  action.payload = { _clickupId: 'task', _clickupTaskDeleted: true, _origin: 'adopted', _history: [{ type: 'tag_removed', ts: now - day }, { type: 'relinked', ts: now - 100 }] };
  action.linkedAdMeta = { taskType: 'format' };
  const snapshot = structuredClone(action);
  assert.deepEqual(planAnomalies(action, now).map((a) => a.type), ['cu_deleted', 'tag_removed', 'relinked']);
  assert.deepEqual(action, snapshot);
  action.linkedAdMeta.taskType = 'production';
  assert.equal(planAnomalies(action, now).some((a) => a.type === 'tag_removed'), false);
  action.linkedAdMeta.taskType = 'format'; delete action.payload._clickupId;
  assert.equal(planAnomalies(action, now).some((a) => a.type === 'tag_removed'), false);
});

test('virtual and imported tasks have no Adopted badge or anomaly', () => {
  const action = row('a', 'Testing');
  action.payload = { _adoptedAt: now };
  assert.deepEqual(planAnomalies(action, now), []);
  for (const payload of [{ _virtual: true }, { id: 'va:abc' }, { _origin: 'adopted' }]) {
    assert.deepEqual(planAnomalies({ ...action, payload }, now), []);
  }
  assert.deepEqual(planAnomalies(row('va:abc', 'Testing'), now), []);
});

test('anomaly expiry is strict, latest stored event wins, and invalid or future timestamps are ignored', () => {
  const action = row('a', 'Testing', { linkedAdId: 'ad' }); action.linkedAdMeta = { taskType: 'format' };
  action.payload = { _clickupId: 'task', _history: [{ type: 'tag_removed', ts: now - 14 * day }, { type: 'relinked', ts: now - day }] };
  assert.deepEqual(planAnomalies(action, now), []);
  assert.equal(planAnomalies(action, now - 1).length, 2);
  for (const ts of [null, {}, 'invalid', Infinity, now + 1]) {
    action.payload._history = [null, { type: 'relinked', ts: now - 1 }, { type: 'relinked', ts }];
    assert.deepEqual(planAnomalies(action, now), []);
  }
  action.payload._history = {}; assert.deepEqual(planAnomalies(action, now), []);
  assert.deepEqual(planAnomalies(null, now), []);
});

test('anomaly filter composes with search, attention, facets and dates and uses the supplied clock', () => {
  const a = row('a', 'Testing', { createdAt: now, lastStatusChangeAt: now }), b = row('b', 'Winner');
  a.payload._history = [{ type: 'relinked', ts: now - day + 1 }]; b.payload._origin = 'adopted';
  const filters = { anomaliesOnly: true, status: ['Testing', 'Winner'], query: 'a', attentionOnly: true, datePreset: 'today' };
  assert.deepEqual(ids([a, b], filters, new Map([['a', { state: 'red' }]])), ['a']);
  assert.deepEqual(ids([a, b], filters, new Map()), []);
  assert.deepEqual(filterPlanActions([a], { ...PLAN_FILTERS, anomaliesOnly: true }, now + 1), []);
});
