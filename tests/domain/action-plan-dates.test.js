import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { planDateRange, planMatchesDate, planTrends, planDayKey } from '../../lib/domain/action-plan-dates.js';
import { filterPlanActions } from '../../lib/domain/action-plan-workspace.js';

const ms = (date) => new Date(`${date}T00:00:00`).getTime();
test('all legacy date presets resolve to local, inclusive calendar dates', () => {
  const now = new Date(2026, 8, 16, 12).getTime();
  const expected = { today: ['2026-09-16', '2026-09-17'], yesterday: ['2026-09-15', '2026-09-16'],
    '7d': ['2026-09-10', '2026-09-17'], week: ['2026-09-14', '2026-09-17'], lastweek: ['2026-09-07', '2026-09-14'],
    '14d': ['2026-09-03', '2026-09-17'], '30d': ['2026-08-18', '2026-09-17'], month: ['2026-09-01', '2026-09-17'], lastmonth: ['2026-08-01', '2026-09-01'] };
  for (const [datePreset, [from, to]] of Object.entries(expected)) assert.deepEqual(planDateRange({ datePreset }, now), { from: ms(from), to: ms(to), error: '' });
  assert.deepEqual(planDateRange({ datePreset: 'all' }, now), { from: null, to: null, error: '' });
  assert.equal(planDayKey(planDateRange({ datePreset: 'lastmonth' }, ms('2026-01-01')).from), '2025-12-01');
});
test('custom dates validate leap years, ordering and completeness without widening results', () => {
  for (const [dateFrom, dateTo] of [['', '2026-09-16'], ['2026-02-29', '2026-03-01'], ['2026-09-17', '2026-09-16'], ['2026-13-01', '2026-13-02']]) {
    const filters = { datePreset: 'custom', dateFrom, dateTo };
    assert.ok(planDateRange(filters).error);
    assert.deepEqual(filterPlanActions([{ display: { source: {}, createdAt: ms('2026-09-16') } }], filters), []);
  }
  assert.equal(planDateRange({ datePreset: 'custom', dateFrom: '2024-02-29', dateTo: '2024-02-29' }).error, '');
});
test('date modes distinguish created and status changed, excluding missing times and including end milliseconds', () => {
  const filters = { datePreset: 'custom', dateFrom: '2026-09-16', dateTo: '2026-09-16', dateMode: 'window' };
  const range = planDateRange(filters);
  const d = { createdAt: ms('2026-08-01'), lastStatusChangeAt: range.to - 1 };
  assert.equal(planMatchesDate(d, filters, range), true);
  assert.equal(planMatchesDate(d, { ...filters, dateMode: 'lifetime' }, range), false);
  assert.equal(planMatchesDate({ lastStatusChangeAt: range.to }, filters, range), false);
  for (const value of [null, undefined, '', 'invalid']) assert.equal(planMatchesDate({ lastStatusChangeAt: value }, filters, range), false);
  assert.equal(planMatchesDate({}, {}, planDateRange({})), true);
});
test('date filters combine with other criteria without changing action records', () => {
  const a = { display: { dbId: 'a', title: 'Energy', source: { kind: 'blank' }, status: 'Testing', createdAt: ms('2026-09-15'), lastStatusChangeAt: ms('2026-09-16') } };
  const b = { display: { ...a.display, dbId: 'b', lastStatusChangeAt: null } };
  const before = structuredClone([a, b]);
  assert.deepEqual(filterPlanActions([a, b], { query: 'energy', status: 'Testing', datePreset: 'today' }, ms('2026-09-16')), [a]);
  assert.deepEqual([a, b], before);
});
test('trends have 30 calendar buckets, use current status and retain all-time winner/loser totals', () => {
  const row = (status, createdAt, lastStatusChangeAt) => ({ display: { status, createdAt, lastStatusChangeAt } });
  const result = planTrends([
    row('Testing', ms('2026-08-18'), ms('2026-09-15')), row('Mild Winner', ms('2026-09-16'), ms('2026-09-16')),
    row('Loser', ms('2026-08-17'), ms('2026-08-17')), row('Live', ms('2026-09-17'), ms('2026-09-17')), row('Winner', null, 'invalid'),
  ], ms('2026-09-16'));
  assert.equal(result.days.length, 30); assert.equal(result.days[0].date, '2026-08-18'); assert.equal(result.days.at(-1).date, '2026-09-16');
  assert.deepEqual(['created', 'launched', 'decided'].map((key) => result.days.reduce((sum, d) => sum + d[key], 0)), [2, 1, 1]);
  assert.equal(result.winRate, 67); assert.equal(result.winners, 2); assert.equal(result.losers, 1);
  assert.equal(planTrends([], ms('2026-09-16')).winRate, 0);
});
test('date filters and trends handle spring/fall DST without duplicated or skipped calendar days', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { planDateRange, planTrends } from './lib/domain/action-plan-dates.js';
    for (const [date,hours] of [['2026-03-08',23],['2026-11-01',25]]) {
      const r=planDateRange({datePreset:'custom',dateFrom:date,dateTo:date});
      assert.equal((r.to-r.from)/3600000,hours);
      const trends=planTrends([{display:{status:'Testing',createdAt:r.to-1,lastStatusChangeAt:r.to-1}}],r.to-1);
      assert.equal(new Set(trends.days.map(d=>d.date)).size,30);
      assert.equal(trends.days.at(-1).created,1); assert.equal(trends.days.at(-1).launched,1);
    }
  `], { encoding: 'utf8', env: { ...process.env, TZ: 'America/New_York' } });
  assert.equal(result.status, 0, result.stderr);
});
