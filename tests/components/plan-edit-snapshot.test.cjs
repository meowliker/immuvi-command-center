const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

function compile(path, imports) {
  const module = { exports: {} };
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  runInNewContext(source, { module, exports: module.exports, Error, require: imports });
  return module.exports;
}
async function fixture() {
  const domain = await import('../../lib/domain/action-plan.js');
  const visibility = await import('../../lib/domain/action-plan-visibility.js');
  const patches = await import('../../lib/domain/plan-edit-patches.js');
  const values = compile('app/command-center/helpers/values.ts', () => ({}));
  const helpers = compile('app/command-center/helpers/actions.ts', id => id.endsWith('values') ? values : id.endsWith('visibility.js') ? visibility : domain);
  const { readPlanEditSnapshot } = compile('app/command-center/services/plan-edit-snapshot.ts', id => id.endsWith('helpers/actions') ? helpers : patches);
  const rows = {
    manual_actions: { id: 'action', product_id: 'qa', updated_at: 'a1', payload: { sourceAdId: 'ad', _clickupId: 'remote', title: 'Test' } },
    ads: { id: 'ad', product_id: 'qa', updated_at: 'v1', format_name: 'Test', angle: 'Old', persona: 'Parents', status: 'Testing', clickup_task_id: 'remote',
      meta: { _trackerPending: { angle: 'Old' }, _customFields: { 'angle tag': 'Old', 'persona tag': 'Parents' }, _customFieldsRaw: { reviewer: [7] } } },
  };
  const baseline = structuredClone(helpers.buildActionRecords([rows.manual_actions], [rows.ads])[0]);
  const db = { from(table) {
    const filters = {};
    return { select() { return this; }, eq(key, value) { filters[key] = value; return this; }, async maybeSingle() {
      assert.equal(filters.product_id, 'qa'); assert.equal(filters.id, table === 'ads' ? 'ad' : 'action');
      return { data: rows[table], error: null };
    } };
  } };
  return { rows, baseline, read: (edit, expected = baseline) => readPlanEditSnapshot(db, 'qa', expected, edit) };
}
test('a queued edit uses the acknowledged version and retains unrelated values from the real action projection', async () => {
  const f = await fixture();
  f.rows.ads.updated_at = 'after-ack'; f.rows.ads.meta._trackerPending = {};
  f.rows.ads.meta.notes = 'Unrelated note';
  const current = await f.read({ kind: 'creative', values: { angle: 'New' } });
  assert.equal(current.adVersion, 'after-ack');
  assert.equal(current.display.angle, 'Old');
  assert.equal(current.linkedAdMeta.notes, 'Unrelated note');
});
test('queued edits reject changed fields, disappeared rows, deletion, quarantine, and relinking', async () => {
  const edit = { kind: 'creative', values: { angle: 'New' } };
  for (const change of [
    rows => { rows.ads.meta._trackerPending.angle = 'Peer'; },
    rows => { rows.ads.deleted_at = 'now'; },
    rows => { rows.ads.meta._productBoundaryQuarantined = true; },
    rows => { rows.ads.clickup_task_id = 'other'; },
    rows => { rows.manual_actions.payload.sourceAdId = 'other'; },
    rows => { rows.manual_actions = null; },
  ]) {
    const f = await fixture(); change(f.rows);
    await assert.rejects(f.read(edit), { name: 'Error' }, String(change));
  }
  const f = await fixture(); f.rows.ads.meta._customFieldsRaw.reviewer = [8];
  await assert.rejects(f.read({ kind: 'fields', values: { reviewer: { name: 'Reviewer', value: [9] } } }), /changed elsewhere/);
});
