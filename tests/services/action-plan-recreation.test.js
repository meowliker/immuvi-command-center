import test from 'node:test';
import assert from 'node:assert/strict';
import { repairPlanClickUp } from '../../lib/services/action-plan-recreation.js';
import { creationMarker } from '../../lib/domain/clickup-creation.js';
const listId = '1301130000002447';
function fixture() {
  const f = { product: { id: 'qa', name: 'QA', updated_at: 'pv', config: {} }, listId,
    input: { adId: 'ad', actionId: 'action', adVersion: 'av', actionVersion: 'mv', oldTaskId: 'old' },
    ad: { id: 'ad', product_id: 'qa', format_name: 'Repair creative', status: 'Untested', updated_at: 'av', clickup_task_id: 'old', meta: { _clickupId: 'old', _clickupTaskDeleted: true, notes: 'Keep notes' } },
    action: { id: 'action', product_id: 'qa', updated_at: 'mv', payload: { sourceAdId: 'ad', _clickupId: 'old', description: 'Keep brief' } },
    job: null, remote: [], calls: [], posts: 0, reads: [] };
  const clone = (value) => structuredClone(value);
  f.db = { from(table) { const filters = {}; return { select() { return this; }, eq(k, v) { filters[k] = v; return this; }, async maybeSingle() {
    f.reads.push({ table, filters }); assert.equal(filters.product_id, 'qa');
    return { data: clone(table === 'ads' ? f.ad : table === 'manual_actions' ? f.action : f.job) };
  } }; }, async rpc(name, args) {
    f.calls.push(name);
    if (name === 'qa_plan_stage') return { data: clone(f.action) };
    if (name === 'qa_plan_repair') {
      if (f.claimError) return { error: { message: 'Snapshot changed' } };
      assert.equal(args.p_old_task_id, 'old'); assert.equal(args.p_ad_updated_at, f.ad.updated_at);
      assert.equal(args.p_action_updated_at, f.action?.updated_at || null);
      f.action ||= { id: 'virtual-promoted', product_id: 'qa', updated_at: 'mv', payload: { sourceAdId: 'ad' } };
      f.ad.updated_at = 'next-av'; f.action.updated_at = 'next-mv'; f.ad.meta._clickupTaskDeleted = false;
      if (args.p_new_task_id) {
        f.ad.clickup_task_id = args.p_new_task_id; f.ad.meta._clickupId = args.p_new_task_id; f.action.payload._clickupId = args.p_new_task_id;
      } else {
        f.ad.clickup_task_id = null; delete f.ad.meta._clickupId; delete f.action.payload._clickupId;
        Object.assign(f.ad.meta, { _qaRecreateFromTaskId: 'old', _qaRecreationJobId: args.p_job_id });
        f.job = { id: args.p_job_id, product_id: 'qa', ad_id: 'ad', action_id: f.action.id, list_id: listId, state: 'sending', payload: args.p_payload, lease_token: args.p_token };
      }
      if (f.losePrepare) { f.losePrepare = false; return { data: null }; }
      return { data: clone({ ad: f.ad, action: f.action, job: f.job }) };
    }
    if (name === 'qa_creation_claim') {
      if (f.leaseActive) return { error: { message: 'Creation is still in progress' } };
      f.job.lease_token = args.p_token; f.job.state = f.job.remote_task_id ? 'created' : 'uncertain';
    }
    if (name === 'qa_creation_record') {
      if (f.loseRecord && args.p_state === 'created') { f.loseRecord = false; return { error: { message: 'Record failed' } }; }
      Object.assign(f.job, { state: args.p_state, remote_task_id: args.p_remote_task_id });
    }
    if (name === 'qa_creation_finish') {
      if (f.loseFinish) { f.loseFinish = false; return { error: { message: 'Finish failed' } }; }
      f.job.state = 'linked'; f.ad.clickup_task_id = f.job.remote_task_id; f.ad.meta._clickupId = f.job.remote_task_id; f.action.payload._clickupId = f.job.remote_task_id;
    }
    return { data: clone(f.job) };
  } };
  f.clickup = {
    async getTask(list, id) { assert.equal(list, listId); if (f.lookupError) throw f.lookupError;
      const task = f.remote.find((t) => t.id === id); if (!task) throw Object.assign(new Error('Missing'), { status: 404 }); return clone(task); },
    async tasks(list, options) { assert.equal(options.includeArchived, true); if (f.listError) throw new Error('Incomplete list'); return clone(f.remote); },
    async inspect() { if (f.schemaError) throw new Error('Invalid schema'); return { list: { id: listId, statuses: [{ status: 'to do' }] }, fields: [] }; },
    async createTask(list, payload) { f.posts++; f.remote.push({ ...payload, id: 'replacement', list: { id: list }, status: { status: payload.status }, due_date: payload.due_date || null });
      if (f.createError) throw new Error('Lost POST response'); return { id: 'replacement' }; },
  };
  f.run = () => repairPlanClickUp(f);
  return f;
}
const remote = (id, description = '') => ({ id, list: { id: listId }, name: 'Repair creative', description });
test('existing original task restores the link without create or list search', async () => {
  const f = fixture(); f.remote = [remote('old')];
  assert.deepEqual(await f.run(), { state: 'linked', taskId: 'old', mode: 'relinked' });
  assert.equal(f.posts, 0); assert.deepEqual(f.calls, ['qa_plan_repair']); assert.equal(f.ad.meta.notes, 'Keep notes');
});
test('lookup errors, stale snapshots, local deletion and schema failures never prepare or POST', async () => {
  for (const mutate of [(f) => f.lookupError = new Error('timeout'), (f) => f.lookupError = Object.assign(new Error('denied'), { status: 403 }),
    (f) => f.ad.updated_at = 'stale', (f) => f.action.updated_at = 'stale', (f) => f.ad.deleted_at = 'stamp',
    (f) => f.ad.meta._productBoundaryQuarantined = true, (f) => f.listError = true, (f) => f.schemaError = true]) {
    const f = fixture(); mutate(f); await assert.rejects(f.run()); assert.equal(f.posts, 0); assert.deepEqual(f.calls, []);
  }
});
test('exact durable marker relinks; duplicate markers or unmarked same-name tasks block recreation', async () => {
  const f = fixture(); f.job = { id: 'prior', product_id: 'qa', ad_id: 'ad', list_id: listId, remote_task_id: 'old', state: 'linked' };
  f.remote = [remote('found', creationMarker('prior'))]; assert.equal((await f.run()).taskId, 'found'); assert.equal(f.posts, 0);
  for (const marked of [true, false]) {
    const g = fixture(); g.job = { ...f.job }; g.remote = marked ? [remote('one', creationMarker('prior')), remote('two', creationMarker('prior'))] : [remote('unrelated')];
    await assert.rejects(g.run(), marked ? /Multiple/ : /same-name/); assert.equal(g.posts, 0); assert.deepEqual(g.calls, []);
  }
});
test('confirmed absence claims a new generation before one POST and preserves brief data', async () => {
  const f = fixture(); assert.equal((await f.run()).mode, 'recreated');
  assert.equal(f.posts, 1); assert.equal(f.job.state, 'linked'); assert.equal(f.remote[0].description.includes('Keep brief'), true);
  assert.equal(f.remote[0].description.includes('Keep notes'), true); assert.equal(f.calls[0], 'qa_plan_repair');
  assert.equal((await f.run()).taskId, 'replacement'); assert.equal(f.posts, 1);
});
test('timeout, failed identity record and failed finalization recover without a second create', async () => {
  for (const flag of ['createError', 'loseRecord', 'loseFinish']) {
    const f = fixture(); f[flag] = true; await assert.rejects(f.run()); assert.equal(f.posts, 1);
    await f.run(); assert.equal(f.posts, 1); assert.equal(f.job.state, 'linked');
  }
});
test('lost prepare acknowledgment and active lease fail closed, including across retry', async () => {
  const f = fixture(); f.losePrepare = true;
  await assert.rejects(f.run(), /acknowledgment/); assert.equal(f.posts, 0);
  f.leaseActive = true; await assert.rejects(f.run(), /still in progress/); assert.equal(f.posts, 0);
  f.leaseActive = false; await assert.rejects(f.run(), /No matching/); assert.equal(f.posts, 0);
  assert.equal(f.calls.filter((n) => n === 'qa_plan_repair').length, 1);
});
test('failed atomic claim, mismatched remote identity or unresolved generation cannot create', async () => {
  const f = fixture(); f.claimError = true; await assert.rejects(f.run(), /Snapshot changed/); assert.equal(f.posts, 0);
  const g = fixture(); g.clickup.getTask = async () => remote('wrong'); await assert.rejects(g.run(), /identity/); assert.deepEqual(g.calls, []);
  const h = fixture(); h.job = { id: 'job', product_id: 'qa', ad_id: 'ad', state: 'uncertain' }; await assert.rejects(h.run(), /existing creation/); assert.deepEqual(h.calls, []);
});
test('virtual repair uses no synthetic action ID and is staged only at atomic repair', async () => {
  const f = fixture(); f.action = null; f.input.actionId = null; f.input.actionVersion = null; f.remote = [remote('old')];
  assert.equal((await f.run()).mode, 'relinked'); assert.equal(f.action.id, 'virtual-promoted'); assert.deepEqual(f.calls, ['qa_plan_repair']);
});
test('altered claim payload cannot send a replacement even with the expected marker', async () => {
  const f = fixture(), rpc = f.db.rpc;
  f.db.rpc = async (name, args) => {
    const result = await rpc(name, args);
    if (name === 'qa_plan_repair') result.data.job.payload.name = 'Unexpected name';
    return result;
  };
  await assert.rejects(f.run(), /claim could not be verified/);
  assert.equal(f.posts, 0);
});
