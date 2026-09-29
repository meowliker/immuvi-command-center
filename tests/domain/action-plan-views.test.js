import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlanViews, normalizePlanColumns, planViewColumns, namedPlanView } from '../../lib/domain/action-plan-views.js';
import { sortPlanActions } from '../../lib/domain/action-plan-workspace.js';
import fs from 'node:fs';
import vm from 'node:vm';
test('default Action Plan columns retain legacy built-ins plus dedicated taxonomy columns', () => {
  const html = fs.readFileSync(new URL('../../immuvi-command-center.html', import.meta.url), 'utf8');
  const literal = html.match(/var _AP_DEFAULT_COLUMNS = (\[[\s\S]*?\]);/)[1];
  const legacy = JSON.parse(JSON.stringify(vm.runInNewContext(literal, {}, { timeout: 1000 })));
  assert.deepEqual(normalizePlanColumns([]).filter(column => !column.hidden && !['angle', 'persona', 'brief', 'adSource', 'driveLink'].includes(column.key)), legacy.map(column => column.key === 'cb' ? { ...column, width: 44 } : column));
});
test('link columns appear beside Origin in old layouts without resetting saved preferences', () => {
  const old = [{ key: 'origin', width: 299, hidden: false }, { key: 'title', width: 320, hidden: false }];
  const columns = normalizePlanColumns(old);
  assert.deepEqual(columns.slice(0, 4).map(column => column.key), ['origin', 'brief', 'adSource', 'driveLink']);
  assert.equal(columns[0].width, 299);
  for (const key of ['brief', 'adSource', 'driveLink']) assert.equal(columns.find(column => column.key === key).hidden, false);
  const custom = [{ key: 'brief', width: 220, hidden: true }, ...columns.filter(column => column.key !== 'brief')];
  assert.deepEqual(normalizePlanColumns(custom), custom);
  assert.deepEqual(normalizePlanColumns(columns), columns);
});
test('all default and legacy view widths satisfy the SQL save contract', () => {
  const sql = fs.readFileSync(new URL('../../supabase/migrations/20260918050000_qa_action_plan_preferences.sql', import.meta.url), 'utf8');
  const [, min, max] = sql.match(/\(col->>'width'\)::numeric not between (\d+) and (\d+)/);
  const state = normalizePlanViews({ activeViewId: 'old', views: [{ id: 'old', name: 'Old', columns: [{ key: 'cb', width: 36, hidden: false }] }] });
  for (const view of state.views) for (const column of view.columns) assert.ok(column.width >= Number(min) && column.width <= Number(max), column.key);
  assert.equal(state.views.find(view => view.id === 'old').columns[0].width, 44);
});
test('only the untouched old QA preset upgrades, customized order/width/visibility survive', () => {
  const old = [['cb',44,false],['title',240,false],['status',140,false],['age',144,false],['due',144,false],['editor',120,false],['reviewer',120,false],['cell',150,false],['origin',110,false],['clickup',180,false],['funnel',90,true],['type',100,true],['hook',140,true],['created',140,true]].map(([key,width,hidden]) => ({key,width,hidden}));
  assert.deepEqual(normalizePlanColumns(old), normalizePlanColumns([]));
  const custom = structuredClone(old); custom[1].width = 360;
  const normalized = normalizePlanColumns(custom);
  assert.deepEqual(normalized.slice(0, 2), custom.slice(0, 2));
  assert.equal(normalized.find(column => column.key === 'funnel').hidden, true);
  assert.equal(normalized.find(column => column.key === 'source').hidden, false);
});
test('saved views normalize malformed input, bounded widths, required columns and unknown columns', () => {
  const columns = normalizePlanColumns([{ key: 'title', width: -3, hidden: true }, { key: 'title', width: 999 }, { key: 'cf:score', width: 900, hidden: false }, { key: 'unknown', width: 200 }]);
  assert.deepEqual(columns[0], { key: 'title', width: 180, hidden: false });
  assert.deepEqual(columns.find(column => column.key === 'cf:score'), { key: 'cf:score', width: 600, hidden: false });
  assert.equal(columns.some((c) => c.key === 'unknown'), false);
  assert.equal(columns.find((c) => c.key === 'cb').hidden, false);
  assert.equal(normalizePlanViews(null).activeViewId, 'default');
});
test('Angle and Persona appear next to the task name without a schema, including older saved layouts', () => {
  for (const view of [null, { columns: [{ key: 'title', width: 320, hidden: false }, { key: 'cf:angle tag', width: 160, hidden: true }] }]) {
    const columns = planViewColumns(view, [], []);
    const title = columns.findIndex(column => column.key === 'title');
    assert.deepEqual(columns.slice(title + 1, title + 3).map(column => [column.key, column.hidden]), [['angle', false], ['persona', false]]);
    assert.equal(columns.filter(column => column.key === 'angle').length, 1);
    assert.deepEqual(normalizePlanColumns(columns), columns);
  }
  const saved = normalizePlanColumns([{ key: 'angle', width: 250, hidden: true }, { key: 'persona', width: 200, hidden: false }]);
  assert.deepEqual(saved[0], { key: 'angle', width: 250, hidden: true });
});
test('legacy layout seeds supported columns without mutating the original; new custom fields are opt-in', () => {
  const legacy = { activeViewId: 'legacy', views: [{ id: 'legacy', name: 'Legacy', columns: [{ key: 'due', width: 200, hidden: false }, { key: 'producer', width: 90, hidden: false }] }] };
  const before = JSON.stringify(legacy), state = normalizePlanViews(legacy);
  assert.equal(state.activeViewId, 'legacy'); assert.equal(state.views[1].columns[0].key, 'due'); assert.equal(JSON.stringify(legacy), before);
  const columns = planViewColumns(state.views[1], [{ linkedAdMeta: { _customFields: { score: '0' } } }]);
  assert.equal(columns.find((c) => c.key === 'cf:score').hidden, true);
});
test('named views validate names, retain independent layouts, and keep default available after truncation', () => {
  const state = normalizePlanViews(null), next = namedPlanView(state, state.views[0].columns, 'Review', 'new');
  assert.equal(next.activeViewId, 'new'); assert.equal(state.views.length, 1);
  assert.throws(() => namedPlanView(next, [], ' review ', 'other'), /already exists/);
  assert.throws(() => namedPlanView(next, [], ' ', 'other'), /view name/);
  const huge = normalizePlanViews({ activeViewId: 'v29', views: Array.from({ length: 30 }, (_, i) => ({ id: `v${i}`, name: `V${i}`, columns: [] })) });
  assert.equal(huge.views.length, 30); assert.equal(huge.activeViewId, 'default');
});
test('custom-field sorting retains zero and pushes absent values last', () => {
  const rows = [2, 0, null].map((value, index) => ({ display: { dbId: String(index) }, linkedAdMeta: { _customFields: { score: value } } }));
  assert.deepEqual(sortPlanActions(rows, 'cf:score', 1).map((r) => r.display.dbId), ['1', '0', '2']);
});
test('legacy people, funnel and type columns sort without putting unassigned rows first', () => {
  const rows = [
    { display: { dbId: 'a', funnelStage: 'TOF', adType: 'Video' }, linkedAdMeta: { _customFieldsRaw: { reviewer: [{ id: 1, username: 'Zed' }] } } },
    { display: { dbId: 'b', funnelStage: 'BOF', adType: 'Photo' }, linkedAdMeta: { _customFieldsRaw: { reviewer: [{ id: 2, username: 'Amy' }] } } },
    { display: { dbId: 'c' }, linkedAdMeta: {} },
  ];
  for (const key of ['reviewer', 'funnelStage', 'adType']) assert.deepEqual(sortPlanActions(rows, key, 1).map(row => row.display.dbId), ['b', 'a', 'c']);
});
