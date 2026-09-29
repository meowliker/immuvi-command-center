import test from 'node:test';
import assert from 'node:assert/strict';
import { pushAllCreativeFields } from '../../lib/services/tracker-bulk-push.js';
import { runClickUpIntegration } from '../../lib/services/clickup-integration.js';

function fixture() {
  const listId = '1301130000002447', calls = [], acks = [];
  const row = { id: 'ad', product_id: 'qa', updated_at: 'v1', clickup_task_id: 'task', angle: 'Energy', persona: 'Parents', funnel_stage: 'TOF',
    status: 'Winner', format_name: 'Keep name', ad_link: 'https://example.test', meta: { creativeStructure: 'UGC', hookType: 'Fear', productionStyle: 'Organic',
      _trackerPending: { angle: 'Energy', status: 'Winner', notes: 'Do not push' } } };
  const fields = [
    { id: 'angle-tag', name: 'Angle Tag', type: 'short_text' },
    { id: 'angle-dd', name: 'Angle', type: 'drop_down', type_config: { options: [{ id: 'energy', name: 'Energy' }] } },
    { id: 'persona-tag', name: 'Persona Tag', type: 'text' },
    { id: 'persona-dd', name: 'Persona', type: 'drop_down', type_config: { options: [{ id: 'parents', name: 'Parents' }] } },
    { id: 'funnel', name: 'Funnel Stage', type: 'short_text' },
    { id: 'structure', name: 'Creative Structure', type: 'short_text' },
    { id: 'hook', name: 'Hook Type', type: 'short_text' },
    { id: 'style', name: 'Production Style', type: 'short_text' },
  ];
  const tombstones = [];
  const product = { id: 'qa', config: { clickup_list_id: listId } };
  const db = { from(table) {
    const filters = {};
    return { select() { return this; }, eq(k, v) { filters[k] = v; return this; }, order() { return this; }, range() { return this; },
      async maybeSingle() { assert.equal(filters.product_id, 'qa'); assert.equal(filters.id, 'ad'); return { data: row }; },
      async abortSignal() { assert.equal(table, 'deleted_ads'); assert.equal(filters.product_id, 'qa'); return { data: tombstones }; } };
  }, async rpc(name, args) { acks.push({ name, args }); return {}; } };
  const clickup = { async inspect(list) { assert.equal(list, listId); return { fields }; },
    async setField(list, task, field, value) { assert.equal(list, listId); assert.equal(task, 'task'); calls.push({ field: field.id, value }); } };
  const input = { operation: 'push-all-creative-fields', adId: 'ad', expectedUpdatedAt: 'v1', expectedTaskId: 'task' };
  const run = () => pushAllCreativeFields({ db, clickup, product, listId, input });
  return { row, fields, product, db, clickup, calls, acks, tombstones, input, listId, run };
}
test('Push All sends current saved fields without requiring pending edits, including dual taxonomy fields', async () => {
  const f = fixture(); const result = await f.run();
  assert.equal(result.pushed, 8); assert.deepEqual(result.failed, []);
  assert.deepEqual(f.calls.map((call) => call.field), ['structure', 'hook', 'style', 'angle-tag', 'angle-dd', 'persona-tag', 'persona-dd', 'funnel']);
  assert.equal(f.calls.find((call) => call.field === 'angle-dd').value, 'energy');
  assert.deepEqual(f.acks[0].args.p_sent, { angle: 'Energy' });
  assert.equal(f.acks[0].name, 'qa_tracker_ack_push');
});
test('bulk route dispatch remains restricted to the QA list and ignores client-supplied field values', async () => {
  const f = fixture();
  await runClickUpIntegration({ ...f, profile: { role: 'member' }, input: { ...f.input, values: { angle: 'Injected' } } });
  assert.equal(f.calls.find((call) => call.field === 'angle-tag').value, 'Energy');
  f.product.config.clickup_list_id = 'production'; f.calls.length = 0;
  await assert.rejects(runClickUpIntegration({ ...f, profile: { role: 'member' } }), /restricted to test list/);
  assert.deepEqual(f.calls, []);
});
test('blank fields do not clear remote data; unmapped fields, missing dropdown options and failures are reported', async () => {
  const f = fixture(); f.row.funnel_stage = ''; f.row.meta.hookType = '\u2014';
  f.fields.find((field) => field.id === 'angle-dd').type_config.options = [];
  f.fields.splice(f.fields.findIndex((field) => field.id === 'style'), 1);
  const result = await f.run();
  assert.equal(result.pushed, 4);
  assert.equal(result.failed.length, 2);
  assert.equal(f.acks.length, 0, 'a failed taxonomy mirror must remain pending');
  assert.equal(f.calls.some((call) => ['funnel', 'hook', 'angle-dd'].includes(call.field)), false);
  const failed = fixture(); failed.clickup.setField = async () => { throw new Error('Synthetic rate limit'); };
  assert.equal((await failed.run()).failed.length, 8); assert.equal(failed.acks.length, 0);
});
test('stale, relinked, foreign, deleted, quarantined and tombstoned creatives cannot push', async () => {
  for (const change of [({ row }) => { row.updated_at = 'v2'; }, ({ row }) => { row.clickup_task_id = 'other'; },
    ({ row }) => { row.product_id = 'foreign'; }, ({ row }) => { row.deleted_at = 'now'; },
    ({ row }) => { row.meta._productBoundaryQuarantined = true; }, ({ tombstones }) => tombstones.push({ id: 'ad', product_id: 'qa' }),
    ({ input }) => { input.expectedUpdatedAt = ''; }]) {
    const f = fixture(); change(f); await assert.rejects(f.run()); assert.deepEqual(f.calls, []); assert.deepEqual(f.acks, []);
  }
});
test('newly available fields override empty saved mappings; abort and acknowledgement failures remain explicit', async () => {
  const f = fixture(); f.product.config.clickup_sync = { list_id: f.listId, mappings: { angle: '' } };
  assert.equal((await f.run()).pushed, 8);
  f.product.config.clickup_sync.mappings={angle:'removed-angle-field'}; f.calls.length=0;
  assert.equal((await f.run()).pushed, 8);
  assert.equal(f.calls.some(call=>call.field==='removed-angle-field'),false);
  const failed = fixture(); failed.db.rpc = async () => ({ error: { message: 'denied' } });
  await assert.rejects(failed.run(), /accepted fields.*could not record/);
  const stopped = fixture(), controller = new AbortController(); controller.abort();
  await assert.rejects(pushAllCreativeFields({ ...stopped, signal: controller.signal }), { name: 'AbortError' });
  assert.deepEqual(stopped.calls, []);
});
