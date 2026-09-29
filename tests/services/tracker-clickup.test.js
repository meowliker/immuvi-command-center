import test from 'node:test';
import assert from 'node:assert/strict';
import { runTrackerClickUp } from '../../lib/services/tracker-clickup.js';
import { createClickUpClient } from '../../lib/services/clickup-client.js';
const listId = '1301130000002447';
const product = { id: 'qa-test', config: { clickup_sync: { list_id: listId, mappings: { angle: 'angle' } } } };
function setup(ad = {}, action = null) {
  const calls = [];
  const db = {
    from(table) {
      const filters = {};
      return { select() { return this; }, eq(key, value) { filters[key] = value; return this; }, async maybeSingle() {
        if (table === 'ads') {
          assert.equal(filters.product_id, product.id);
          return { data: { id: 'ad', clickup_task_id: 'task', ...ad } };
        }
        if (table === 'manual_actions') {
          assert.equal(filters.product_id, product.id); assert.equal(filters.id, 'action');
          return { data: action };
        }
        return { data: null };
      } };
    },
    async rpc(name, args) { calls.push({ name, args }); return {}; },
  };
  const clickup = {
    async inspect() { return { list: { statuses: [{ status: 'testing' }, { status: 'winner' }] }, fields: [{ id: 'angle', name: 'Angle', type: 'drop_down', type_config: { options: [{ id: 'energy', name: 'Energy' }] } }] }; },
    async updateTask(list, id, fields) { calls.push({ list, id, fields }); },
    async getTask() { return { description: 'Keep this brief\nCreative Hypothesis: old\nKeep this link' }; },
    async setField(list, id, field, value) { calls.push({ field: field.id, value }); },
    async deleteTask() { calls.push('delete'); },
  };
  const run = (input = {}) => runTrackerClickUp({ db, clickup, product, listId, input: { operation: 'push-creative', adId: 'ad', ...input } });
  return { run, calls, clickup, db };
}
test('push acknowledges successful fields only and retains unmapped edits', async () => {
  const { run, calls } = setup({ meta: { _trackerPending: { format_name: 'New', angle: 'Energy', notes: 'No mapping', 'custom:missing': false } } });
  const result = await run();
  assert.equal(result.pushed, 2);
  assert.deepEqual(result.failed.map((item) => item.field), ['notes', 'custom:missing']);
  assert.deepEqual(calls.at(-1).args.p_sent, { format_name: 'New', angle: 'Energy' });
  assert.deepEqual(calls[1], { field: 'angle', value: 'energy' });
});

test('outbound edits detect fields added or replaced after linking and ignore stale saved IDs', async () => {
  const f=setup({meta:{_trackerPending:{angle:'Energy',persona:'Parents'}}});
  f.clickup.inspect=async()=>({fields:[{id:'new-angle',name:'Angle Tag',type:'short_text'},{id:'new-persona',name:'Persona Tag',type:'short_text'}]});
  for(const mappings of [{angle:'old-id',persona:'deleted-id'},{angle:'',persona:''}]) {
    f.calls.length=0;
    const result=await runTrackerClickUp({db:f.db,clickup:f.clickup,product:{...product,config:{clickup_sync:{list_id:listId,mappings}}},listId,input:{operation:'push-creative',adId:'ad'}});
    assert.equal(result.pushed,2);assert.deepEqual(result.failed,[]);
    assert.deepEqual(f.calls.slice(0,2),[{field:'new-angle',value:'Energy'},{field:'new-persona',value:'Parents'}]);
  }
});

test('editor schema detects current fields rather than reusing the link-time mapping', async () => {
  const f=setup(); f.clickup.members=async()=>[];
  f.clickup.inspect=async()=>({fields:[{id:'replacement',name:'Angle Tag',type:'short_text'}]});
  const schema=await f.run({operation:'creative-schema'});
  assert.equal(schema.mappings.angle,'replacement');
});

test('ordinary taxonomy edits dual-write text and the best dropdown; failures remain pending', async () => {
  const f = setup({ meta: { _trackerPending: { angle: 'Energy' } } });
  const dropdown = { id: 'dd', name: 'Angle', type: 'drop_down', type_config: { options: [{ id: 'energy', name: 'Energy' }] } };
  f.clickup.inspect = async () => ({ fields: [
    { id: 'empty-dd', name: 'Angle', type: 'drop_down', type_config: { options: [] } },
    { id: 'tag', name: 'Angle Tag', type: 'short_text' }, dropdown,
  ] });
  assert.deepEqual(await f.run(), { pushed: 1, failed: [] });
  assert.deepEqual(f.calls.slice(0, 2), [{ field: 'tag', value: 'Energy' }, { field: 'dd', value: 'energy' }]);
  dropdown.type_config.options = [{ id: 'other', name: 'Other' }]; f.calls.length = 0;
  const failed = await f.run();
  assert.equal(failed.pushed, 0); assert.match(failed.failed[0].error, /remains pending/);
  assert.deepEqual(f.calls, [{ field: 'tag', value: 'Energy' }]);
});

test('clearing taxonomy clears both fields so a stale dropdown cannot restore a removed tag', async () => {
  const f = setup({ meta: { _trackerPending: { persona: '' } } });
  f.clickup.inspect = async () => ({ fields: [
    { id: 'tag', name: 'Persona Tag', type: 'text' }, { id: 'dd', name: 'Persona', type: 'drop_down' },
  ] });
  assert.equal((await f.run()).pushed, 1);
  assert.deepEqual(f.calls.slice(0, 2), [{ field: 'tag', value: null }, { field: 'dd', value: null }]);
});
test('hypothesis edits preserve surrounding task description and dollar signs', async () => {
  const { run, calls } = setup({ meta: { _trackerPending: { creativeHypothesis: '$1 updated' } } });
  await run();
  assert.equal(calls[0].fields.description, 'Keep this brief\nCreative Hypothesis: $1 updated\nKeep this link');
});
test('failed remote writes are not acknowledged and successful remote/local ack failures are explicit', async () => {
  const fixture = setup({ meta: { _trackerPending: { status: 'Winner' } } });
  fixture.clickup.updateTask = async () => { throw new Error('rate limit'); };
  assert.equal((await fixture.run()).failed[0].error, 'rate limit');
  assert.equal(fixture.calls.length, 0);
  fixture.clickup.updateTask = async () => {};
  fixture.db.rpc = async () => ({ error: { message: 'conflict' } });
  await assert.rejects(fixture.run(), /accepted changes.*could not record/);
});

test('a pending status not in the linked list is not sent or acknowledged', async () => {
  const fixture = setup({ meta: { _trackerPending: { status: 'Assigned' } } });
  const result = await fixture.run();
  assert.equal(result.pushed, 0);
  assert.match(result.failed[0].error, /not available/);
  assert.deepEqual(fixture.calls, []);
});
test('remote deletion requires a local tombstone; winners must belong to the creative', async () => {
  const fixture = setup();
  await assert.rejects(fixture.run({ operation: 'delete-creative-task' }), /locally/);
  await assert.rejects(fixture.run({ operation: 'winner-comment', fileId: 'foreign' }), /no longer available/);
  const deleted = setup({ deleted_at: '2026-09-17' });
  assert.deepEqual(await deleted.run({ operation: 'delete-creative-task' }), { deleted: true });
  await assert.rejects(deleted.run(), /deleted/);
});
test('Action Plan bulk pushes verify the current scoped action and exact remote identity before sending', async () => {
  const ad = { meta: { _trackerPending: { status: 'Testing' } } };
  for (const payload of [null, { sourceAdId: 'wrong' }, { sourceAdId: 'ad', _clickupId: 'wrong-task' }]) {
    const fixture = setup(ad, payload ? { payload } : null);
    await assert.rejects(fixture.run({ actionId: 'action' }), /identity changed/);
    assert.deepEqual(fixture.calls, []);
  }
  const valid = setup(ad, { payload: { sourceAdId: 'ad', _clickupId: 'task' } });
  assert.equal((await valid.run({ actionId: 'action' })).pushed, 1);
  const quarantined = setup({ meta: { ...ad.meta, _productBoundaryQuarantined: true } });
  await assert.rejects(quarantined.run(), /quarantined/);
  assert.deepEqual(quarantined.calls, []);
});

test('Action Plan status reaches the HTTP client before the pending edit is acknowledged', async () => {
  const fixture = setup({ meta: { _trackerPending: { status: 'Testing' } } }, { payload: { sourceAdId: 'ad', _clickupId: 'task' } });
  const requests = [];
  let remoteStatus = 'untested';
  const clickup = createClickUpClient('synthetic-key', { fetchImpl: async (url, options) => {
    const path = new URL(url).pathname;
    requests.push(`${options.method} ${path}`);
    if (path.endsWith('/field')) return Response.json({ fields: [] });
    if (path.includes('/list/')) return Response.json({ id: listId, statuses: [{ status: 'testing' }] });
    if (options.method === 'PUT') {
      assert.deepEqual(JSON.parse(options.body), { status: 'testing' });
      assert.equal(fixture.calls.length, 0, 'Do not acknowledge before remote acceptance');
      remoteStatus = 'testing';
    }
    return Response.json({ id: 'task', list: { id: listId }, status: { status: remoteStatus } });
  } });
  const result = await runTrackerClickUp({ db: fixture.db, clickup, product, listId, input: { operation: 'push-creative', adId: 'ad', actionId: 'action' } });
  assert.equal(result.pushed, 1);
  assert.deepEqual(result.failed, []);
  assert.ok(requests.includes('PUT /api/v2/task/task'));
  assert.deepEqual(fixture.calls.at(-1).args.p_sent, { status: 'Testing' });
});
test('Action Plan inline and drawer fields push typed values without overwriting unrelated task data', async () => {
  const fields = [
    { id: 'editor', name: 'Editor', type: 'users' }, { id: 'reviewer', name: 'Reviewer', type: 'users' },
    { id: 'labels', name: 'Labels', type: 'labels', type_config: { options: [{ id: 'chosen', label: 'Chosen' }] } },
    { id: 'product', name: 'Product', type: 'drop_down', type_config: { options: [{ id: 'qa', name: 'QA' }] } },
    { id: 'approved', name: 'Approved Date', type: 'date' }, { id: 'score', name: 'Spend', type: 'number' },
    { id: 'check', name: 'Checked', type: 'checkbox' }, { id: 'notes', name: 'Notes', type: 'text' },
  ];
  const values = { editor: [7, 8], reviewer: [], labels: ['chosen'], product: 'qa', approved: Date.parse('2026-09-28T12:00:00Z'), score: 0, check: false, notes: null };
  const pending = Object.fromEntries(Object.entries(values).map(([id, value]) => [`custom:${id}`, value]));
  pending['custom:__task_assignees'] = [9];
  const fixture = setup({ meta: { _trackerPending: pending } }, { payload: { sourceAdId: 'ad', _clickupId: 'task' } });
  fixture.clickup.inspect = async () => ({ fields });
  fixture.clickup.setAssignees = async (list, task, users) => fixture.calls.push({ native: true, list, task, users });
  const result = await fixture.run({ actionId: 'action' });
  assert.equal(result.pushed, 9); assert.deepEqual(result.failed, []);
  assert.deepEqual(fixture.calls.slice(0, 8), Object.entries(values).map(([field, value]) => ({ field, value })));
  assert.deepEqual(fixture.calls[8], { native: true, list: listId, task: 'task', users: [9] });
  assert.deepEqual(fixture.calls.at(-1).args.p_sent, pending);
});
