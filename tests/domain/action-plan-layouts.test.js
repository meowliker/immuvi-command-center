import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { planPipelineGroups, planWeekDays } from '../../lib/domain/action-plan-layouts.js';

const action = (id, status, createdAt = null, lastStatusChangeAt = null) => ({ display: { dbId: id, status, createdAt, lastStatusChangeAt } });
test('pipeline preserves configured order, merges status casing and keeps unknown tasks visible', () => {
  const actions = [action('1', 'Testing'), action('2', 'testing'), action('3', 'Custom review'), action('4', ' ')];
  const statuses = [{ status: 'winner', orderindex: 2 }, { status: 'testing', orderindex: 1 }, null, { status: 'TESTING', orderindex: 3 }];
  const original = structuredClone({ actions, statuses });
  const groups = planPipelineGroups(actions, statuses);
  assert.deepEqual(groups.map((g) => g.key), ['testing', 'winner', 'custom review', 'unassigned']);
  assert.equal(groups[0].actions.length, 2); assert.equal(groups[1].actions.length, 0);
  assert.equal(groups.flatMap((g) => g.actions).length, 4);
  assert.deepEqual({ actions, statuses }, original);
});
test('pipeline has empty columns for filtered statuses and sensible empty-data fallback', () => {
  const actions = [action('1', 'Testing'), action('2', 'Winner')];
  assert.deepEqual(planPipelineGroups([actions[0]], [], actions).map((g) => g.actions.length), [1, 0]);
  assert.equal(planPipelineGroups([]).length, 6);
  assert.equal(planPipelineGroups([], [{ status: '' }, { status: 42 }]).length, 6);
});
test('week starts Monday, includes Sunday, and uses creation/latest status rather than due dates', () => {
  const ms = (day, hour = 12) => new Date(2026, 8, day, hour).getTime();
  const actions = [action('1', 'Testing', ms(14), ms(15)), action('2', 'Mild Winner', ms(20), ms(20)),
    action('3', 'Loser', ms(13), ms(14, 0)), action('4', 'Live', ms(21, 0), ms(16)),
    { ...action('5', 'In Production'), dueDate: '2026-09-17' }];
  const days = planWeekDays(actions, ms(20, 23));
  assert.equal(days[0].start, ms(14, 0)); assert.equal(days[6].end, ms(21, 0));
  assert.equal(days[0].created, 1); assert.equal(days[0].decided, 1);
  assert.equal(days[1].launched, 1); assert.equal(days[2].launched, 1);
  assert.equal(days[6].created, 1); assert.equal(days[6].decided, 1);
  assert.equal(days.reduce((n, d) => n + d.created, 0), 2);
});
test('week marks future days, ignores invalid dates and recalculates at Monday rollover', () => {
  const now = new Date(2026, 8, 16, 12).getTime();
  const days = planWeekDays([action('1', 'Winner', new Date(2026, 8, 20).getTime(), 'invalid')], now);
  assert.deepEqual(days.map((d) => d.future), [false, false, false, true, true, true, true]);
  assert.equal(days.reduce((n, d) => n + d.created + d.decided, 0), 0);
  assert.equal(new Date(planWeekDays([], new Date(2026, 8, 21).getTime())[0].start).getDate(), 21);
  assert.deepEqual(planWeekDays([], NaN), []);
});
test('week day boundaries follow both daylight-saving transitions', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { planWeekDays } from './lib/domain/action-plan-layouts.js';
    for (const [month, date, hours] of [[2,8,23],[10,1,25]]) {
      const now = new Date(2026,month,date,23,59).getTime();
      const sunday = planWeekDays([],now)[6];
      assert.equal((sunday.end-sunday.start)/3600000,hours);
      const actions = [{display:{status:'Testing',createdAt:sunday.end-1,lastStatusChangeAt:sunday.end}}];
      const day = planWeekDays(actions,now)[6];
      assert.equal(day.created,1); assert.equal(day.launched,0);
    }
  `], { encoding: 'utf8', env: { ...process.env, TZ: 'America/New_York' } });
  assert.equal(result.status, 0, result.stderr);
});
