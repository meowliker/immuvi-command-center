import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeActionAd } from '../../lib/domain/action-plan.js';
import { planAgeThresholds, planHealth, planRowAge, planStatusTimestamp, planTerminalStatus, planTestingCheckpoint } from '../../lib/domain/action-plan-health.js';
import { filterPlanActions, PLAN_FILTERS } from '../../lib/domain/action-plan-workspace.js';
import { planWeekDays } from '../../lib/domain/action-plan-layouts.js';
import { planTrends } from '../../lib/domain/action-plan-dates.js';

const DAY = 86_400_000, now = Date.parse('2026-09-16T12:00:00Z');
const ad = (id, status = 'Testing', days = 8, extra = {}) => ({ id, productId: 'p', status, createdAt: now - 40 * DAY, lastStatusChangeAt: now - days * DAY, ...extra });
const action = (source) => ({ display: { dbId: `action-${source.id}`, linkedAdId: source.id, productId: source.productId, title: source.id, status: source.status, lastStatusChangeAt: source.lastStatusChangeAt, createdAt: source.createdAt, source: { kind: 'manual' } }, payload: {} });

test('linked completion projects one immutable timestamp for age and date consumers', () => {
  const source = ad('a', 'Ready to Launch', 20), row = { ...action(source), adVersion: 'v1' }, snapshot = structuredClone(row);
  const health = planHealth([row], [source], now, [], {}, new Map([['a', now - DAY]]));
  assert.equal(health.actions[0].display.lastStatusChangeAt, now - DAY);
  assert.equal(health.ages.get('action-a').label, '1d');
  assert.equal(health.actions[0].adVersion, 'v1'); assert.equal(health.actions[0].payload, row.payload);
  assert.deepEqual(row, snapshot);
  assert.equal(planStatusTimestamp(source, new Set(), now, now + DAY), now);
  assert.equal(planStatusTimestamp({ ...source, lastStatusChangeAt: now }, new Set(), now, now - DAY), now);
  assert.equal(planStatusTimestamp({ ...source, status: 'Testing' }, new Set(), now, now - DAY), now - 20 * DAY);
});

test('filters, week and trends consume the repaired status date, not the polluted raw date', () => {
  const source = ad('a', 'Testing', 40, { _customFieldsRaw: { 'launch date': now } });
  const health = planHealth([action(source)], [source], now);
  assert.equal(filterPlanActions(health.actions, { ...PLAN_FILTERS, datePreset: 'today' }, now).length, 1);
  assert.equal(planWeekDays(health.actions, now).reduce((sum, day) => sum + day.launched, 0), 1);
  assert.equal(planTrends(health.actions, now).days.at(-1).launched, 1);
  assert.equal(health.ages.get('action-a').label, 'just now');
});

test('age thresholds use exact elapsed boundaries and informative labels', () => {
  for (const [days, state] of [[0, 'green'], [0.99, 'green'], [1, 'yellow'], [1.99, 'yellow'], [2, 'red']]) {
    assert.equal(planRowAge({ status: 'Untested' }, now - days * DAY, null, now).state, state);
  }
  assert.equal(planRowAge({ status: 'Ready to Launch' }, now - 2 * DAY, null, now).state, 'yellow');
  assert.equal(planRowAge({ status: 'Ready to Launch' }, now - 3 * DAY, null, now).state, 'red');
  assert.equal(planRowAge({ status: 'Paused' }, now - 30 * DAY, null, now).state, 'none');
  assert.equal(planRowAge({ status: 'Unknown' }, now, null, now).state, 'none');
  assert.equal(planRowAge({ status: 'constructor' }, now, null, now).state, 'none');
  assert.equal(planRowAge({ status: 'Testing' }, null, null, now).label, '-');
  assert.equal(planRowAge({ status: 'QA' }, now - DAY / 2, null, now).label, '12h');
  assert.equal(planRowAge({ status: 'QA' }, now + DAY, null, now).label, 'just now');
});

test('production due override uses exact due timestamp, but terminal statuses stay neutral', () => {
  assert.equal(planRowAge({ status: 'Production', dueAtMs: now - 1 }, now, null, now).state, 'red');
  assert.equal(planRowAge({ status: 'Production', dueAtMs: now }, now, null, now).state, 'green');
  assert.equal(planRowAge({ status: 'Production', dueAtMs: 'invalid' }, now, null, now).state, 'green');
  const statuses = [{ status: 'Production', type: 'closed' }, { status: 'QA', type: 'done' }];
  assert.equal(planRowAge({ status: 'Production', dueAtMs: now - 1 }, now - 30 * DAY, null, now, undefined, statuses).state, 'none');
  for (const status of ['Winner', 'Loser', 'Mild Winner', 'Scale', 'Killed', 'Complete', 'Archived', 'QA']) {
    assert.equal(planTerminalStatus(status, statuses), true);
    assert.equal(planRowAge({ status }, now - 30 * DAY, null, now, undefined, statuses).state, 'none');
  }
  assert.equal(planTerminalStatus('Scaling', statuses), false);
});

test('testing review becomes first at day seven and final at day fourteen', () => {
  for (const [days, phase] of [[6.99, 'none'], [7, 'first'], [13.99, 'first'], [14, 'final']]) {
    const value = planRowAge({ status: 'Testing' }, now - days * DAY, null, now);
    assert.equal(value.phase, phase);
    if (phase !== 'none') assert.equal(value.state, 'red');
  }
  assert.equal(planTestingCheckpoint('Live', now - 15 * DAY, null, now).phase, 'none');
  assert.equal(planTestingCheckpoint('Testing', null, now - 10 * DAY, now).phase, 'none');
});

test('existing snooze lasts seven elapsed days even beyond original day fourteen', () => {
  const entered = now - 20 * DAY;
  const snoozed = planRowAge({ status: 'Testing' }, entered, now - 6 * DAY, now);
  assert.equal(snoozed.phase, 'snoozed'); assert.equal(snoozed.state, 'none');
  assert.equal(snoozed.dueAt, now + DAY);
  assert.equal(planRowAge({ status: 'Testing' }, entered, now - 7 * DAY, now).phase, 'final');
  assert.equal(planRowAge({ status: 'Testing' }, entered, 'invalid', now).phase, 'final');
});

test('status clock honors launch/approved dates, caps future values, and rejects polluted baselines', () => {
  const source = ad('a', 'Testing', 20, { _customFieldsRaw: { 'launch date': String(now - 3 * DAY) } });
  assert.equal(planStatusTimestamp(source, new Set(), now), now - 3 * DAY);
  assert.equal(planStatusTimestamp({ ...source, lastStatusChangeAt: now - DAY }, new Set(), now), now - DAY);
  assert.equal(planStatusTimestamp({ ...source, _customFieldsRaw: { 'launch date': now + DAY } }, new Set(), now), now);
  assert.equal(planStatusTimestamp({ ...source, status: 'In Production', _customFields: { 'approved date': new Date(now - 2 * DAY).toISOString() } }, new Set(), now), now - 2 * DAY);
  assert.equal(planStatusTimestamp({ ...source, lastStatusChangeAt: now - DAY }, new Set([now - DAY]), now), now - 3 * DAY);
  assert.equal(planStatusTimestamp({ status: 'Unknown', lastStatusChangeAt: now - DAY }, new Set([now - DAY]), now), null);
});

test('pollution detection includes unlinked product ads and excludes foreign-product collisions', () => {
  const source = ad('a', 'Testing', 1, { _customFieldsRaw: { 'launch date': now - 8 * DAY } });
  const rest = Array.from({ length: 4 }, (_, index) => ad(`extra-${index}`, 'Untested', 1));
  assert.equal(planHealth([action(source)], [source, ...rest], now).total, 1);
  assert.equal(planHealth([action(source)], [source, ...rest.map((row) => ({ ...row, productId: 'other' }))], now).total, 0);
  assert.equal(planHealth([action(source), { ...action(source), display: { ...action(source).display, dbId: 'duplicate-card' } }], [source], now).total, 0);
});

test('threshold overrides validate numeric bounds, disable statuses, and never override terminal/checkpoint rules', () => {
  const rules = planAgeThresholds({ UNTESTED: { yellow: 10, red: 20 }, Ready: null, QA: { yellow: 4, red: 2 }, Testing: { yellow: 30, red: 40 }, Winner: { yellow: 0, red: 0 }, review: { yellow: -1, red: Infinity } });
  assert.deepEqual(rules.untested, [10, 20]); assert.equal(rules.ready, null); assert.deepEqual(rules.qa, [1, 2]);
  assert.equal(planRowAge({ status: 'Untested' }, now - 8 * DAY, null, now, rules).state, 'green');
  assert.equal(planRowAge({ status: 'Testing' }, now - 8 * DAY, null, now, rules).state, 'red');
  assert.equal(planRowAge({ status: 'Winner' }, now - 8 * DAY, null, now, rules).state, 'none');
  assert.deepEqual(planAgeThresholds(null), planAgeThresholds('{broken'));
});

test('normalized checkpoint fields, standalone fallback, due overrides, and optimistic status transitions', () => {
  const source = normalizeActionAd({ id: 'a', product_id: 'p', status: 'Testing', created_at: new Date(now - 40 * DAY).toISOString(), last_status_change_at: now - 20 * DAY, testing_deferred_at: now - DAY, testing_defer_count: 1 });
  const row = action(source);
  assert.equal(planHealth([row], [source], now).ages.get('action-a').phase, 'snoozed');
  const changed = { ...row, display: { ...row.display, status: 'In Production', lastStatusChangeAt: now }, payload: { _dueDateMs: now - 1 } };
  assert.equal(planHealth([changed], [source], now).ages.get('action-a').state, 'red');
  const standalone = { display: { dbId: 'manual', status: 'Testing', lastStatusChangeAt: now - 8 * DAY }, payload: {} };
  assert.equal(planHealth([standalone], [], now).ages.get('manual').phase, 'first');
  const fallback = { display: { dbId: 'no-stamp', status: 'Testing', createdAt: now - 8 * DAY }, payload: {} };
  assert.equal(planHealth([fallback], [], now).ages.get('no-stamp').phase, 'none');
});

test('attention groups/filter compose without changing source actions or hidden selections', () => {
  const ads = [ad('a'), ad('b', 'Winner', 20), ad('c', 'Untested', 3), ad('d', 'Testing', 20, { testingDeferredAt: now - DAY })];
  const actions = ads.map(action), snapshot = structuredClone(actions);
  const health = planHealth(actions, ads, now);
  assert.equal(health.total, 2); assert.deepEqual([...health.groups], [['Testing', 1], ['Untested', 1]]);
  assert.deepEqual(filterPlanActions(actions, { ...PLAN_FILTERS, attentionOnly: true }, now, health.ages).map((a) => a.display.dbId), ['action-a', 'action-c']);
  assert.deepEqual(filterPlanActions(actions, { ...PLAN_FILTERS, attentionOnly: true, status: 'Untested' }, now, health.ages).map((a) => a.display.dbId), ['action-c']);
  assert.deepEqual(actions, snapshot);
});
