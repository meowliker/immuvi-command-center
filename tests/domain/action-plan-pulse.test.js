import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { planPulse, planPulseKeys, togglePlanPulse, latestPlanActivity, PLAN_PULSE_TODAY, PLAN_PULSE_PERIOD } from '../../lib/domain/action-plan-pulse.js';
import { filterPlanActions, PLAN_FILTERS } from '../../lib/domain/action-plan-workspace.js';

const now = new Date(2026, 8, 16, 12).getTime();
const date = (day) => new Date(2026, 8, day, 12).getTime();
const action = (id, status, created = 16, changed = 16) => ({ display: { dbId: id, title: id, status, createdAt: date(created), lastStatusChangeAt: date(changed), source: { kind: 'blank' }, adType: 'Video' } });
const rows = [action('brief', 'Untested'), action('prod', 'In Progress'), action('ready', 'Ready to Launch'), action('testing', 'Testing', 14, 15), action('winner', 'Mild Winner'), action('scale', 'Scale'), action('kill', 'Killed'), action('done', 'Complete'), action('old', 'Live', 12, 12), action('future', 'Live', 17, 17)];
test('historical QA tasks stay out of a new week but appear in all-time totals and tile filters', () => {
  const historical = rows.slice(0, -1);
  const monday = new Date(2026, 8, 28, 2).getTime();
  assert.equal(planPulse(historical, PLAN_FILTERS, monday).week.created, 0);
  assert.equal(latestPlanActivity(historical), date(16));
  assert.equal(latestPlanActivity([]), null);
  const filters = { ...PLAN_FILTERS, pulseRange: true, datePreset: 'all' };
  const counts = planPulse(historical, filters, monday);
  assert.equal(counts.week.created, historical.length);
  assert.equal(counts.today.created, 0);
  for (const metric of PLAN_PULSE_PERIOD) assert.equal(filterPlanActions(historical, togglePlanPulse(filters, `week:${metric}`), monday).length, counts.week[metric]);
  assert.equal(filterPlanActions(historical, togglePlanPulse(filters, 'today:created'), monday).length, 0);
});
test('every individual pulse tile counts exactly the rows its filter shows, including zero-count and status aliases', () => {
  const p = planPulse(rows, PLAN_FILTERS, now);
  assert.equal(p.today.launched, 0); assert.equal(p.week.launched, 1); assert.equal(p.today.decisions, 4);
  assert.equal(p.previous.launched, 1);
  for (const [scope, metrics] of [['today', PLAN_PULSE_TODAY], ['week', PLAN_PULSE_PERIOD]]) {
    for (const metric of metrics) assert.equal(filterPlanActions(rows, togglePlanPulse(PLAN_FILTERS, `${scope}:${metric}`), now).length, p[scope][metric], `${scope}:${metric}`);
  }
});
test('tiles form a status union with last-active scope and mixed selections use status time', () => {
  let f = togglePlanPulse(PLAN_FILTERS, 'today:created'); assert.equal(f.dateMode, 'lifetime');
  f = togglePlanPulse(f, 'week:launched'); assert.equal(f.datePreset, 'week'); assert.equal(f.dateMode, 'window');
  assert.deepEqual(filterPlanActions(rows, f, now).map((r) => r.display.dbId), ['testing']);
  f = togglePlanPulse(f, 'today:decisions'); assert.equal(f.datePreset, 'today');
  assert.deepEqual(filterPlanActions(rows, f, now).map((r) => r.display.dbId), ['winner', 'scale', 'kill', 'done']);
  f = togglePlanPulse(f, 'today:decisions'); assert.equal(f.datePreset, 'week');
  f = togglePlanPulse(f, 'week:launched'); assert.equal(f.dateMode, 'lifetime');
  f = togglePlanPulse(f, 'today:created'); assert.equal(f.datePreset, 'all'); assert.deepEqual(f.pulseKeys, []);
});
test('custom period survives toggles and clearing the last tile; explicit criteria still compose', () => {
  const base = { ...PLAN_FILTERS, pulseRange: true, datePreset: 'custom', dateFrom: '2026-09-12', dateTo: '2026-09-15', query: 'testing', adType: 'Video' };
  const f = togglePlanPulse(base, 'today:launched');
  assert.equal(f.datePreset, 'custom'); assert.equal(f.dateFrom, base.dateFrom);
  assert.deepEqual(filterPlanActions(rows, f, now).map((r) => r.display.dbId), ['testing']);
  assert.equal(filterPlanActions(rows, { ...f, adType: 'Image' }, now).length, 0);
  assert.deepEqual(togglePlanPulse(f, 'today:launched'), base);
  const created = togglePlanPulse(base, 'week:created');
  assert.equal(togglePlanPulse(created, 'week:created').dateMode, 'lifetime');
  const p = planPulse(rows, f, now); assert.equal(p.week.launched, 2);
  assert.equal(p.delta.launched, p.week.launched - p.previous.launched);
});
test('invalid keys/dates and missing timestamps are safe and source/filter state is immutable', () => {
  assert.deepEqual(planPulseKeys(['today:created', 'today:created', 'today:created:bad', 'other:created', 'week:production', null]), ['today:created']);
  assert.equal(togglePlanPulse(PLAN_FILTERS, 'wrong'), PLAN_FILTERS);
  const snapshot = structuredClone(rows), filters = structuredClone(PLAN_FILTERS);
  planPulse(rows, filters, now); togglePlanPulse(filters, 'today:briefed'); assert.deepEqual(rows, snapshot); assert.deepEqual(filters, PLAN_FILTERS);
  const p = planPulse([{ display: { status: 'Live', createdAt: null, lastStatusChangeAt: 'bad' } }], filters, now); assert.equal(p.today.created, 0); assert.equal(p.week.launched, 0);
  assert.equal(planPulse(rows, { ...filters, pulseRange: true, datePreset: 'custom', dateFrom: 'bad', dateTo: 'bad' }, now).week.created, 0);
});
test('pulse windows and clicked filters agree across DST and include the final millisecond', () => {
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { planPulse, togglePlanPulse } from './lib/domain/action-plan-pulse.js';
    import { PLAN_FILTERS, filterPlanActions } from './lib/domain/action-plan-workspace.js';
    import { planDateRange } from './lib/domain/action-plan-dates.js';
    for (const date of ['2026-03-08', '2026-11-01']) {
      const f = { ...PLAN_FILTERS, pulseRange: true, datePreset: 'custom', dateFrom: date, dateTo: date };
      const r = planDateRange(f), now = r.to - 1;
      const rows = [r.from, r.to - 1, r.to].map(stamp => ({ display: { status: 'Live', source: {}, createdAt: stamp, lastStatusChangeAt: stamp } }));
      assert.equal(planPulse(rows, f, now).week.launched, 2);
      assert.equal(filterPlanActions(rows, togglePlanPulse(f, 'week:launched'), now).length, 2);
    }
  `], { encoding: 'utf8', env: { ...process.env, TZ: 'America/New_York' } });
  assert.equal(child.status, 0, child.stderr);
});
