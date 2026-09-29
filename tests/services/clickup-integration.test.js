import test from 'node:test';
import assert from 'node:assert/strict';
import { runClickUpIntegration, readProductRows } from '../../lib/services/clickup-integration.js';
import { QA_CLICKUP_LIST_ID as listId } from '../../lib/domain/clickup-sync.js';

function fixture(failTable = '') {
  const calls = [], commits = [];
  const product = { id: 'qa', updated_at: '2026-01-01', config: { clickup_list_id: listId, keep: 'yes' } };
  const db = {
    from(table) {
      const query = { select() { return this; }, eq(column, value) { calls.push([table, column, value]); return this; },
        order() { return this; }, range() { return this; }, abortSignal() { return Promise.resolve({ data: [], error: table === failTable ? { message: 'unavailable' } : null }); } };
      return query;
    },
    async rpc(name, args) { commits.push({ name, args }); return { data: { updated_at: 'new-version', imported: 0 } }; },
  };
  const clickup = { async inspect(id) { assert.equal(id, listId); calls.push('schema'); return { list: { id, name: 'Test list' }, fields: [{ id: 'angle', name: 'Angle', type: 'text' }] }; },
    async tasks(id) { calls.push('tasks'); return []; } };
  return { db, product, clickup, profile: { role: 'admin' }, input: { operation: 'sync' }, calls, commits };
}

test('pipeline statuses are member-readable, QA-list bounded and never write data', async () => {
  const setup = fixture();
  setup.input = { operation: 'plan-statuses' }; setup.profile.role = 'member';
  assert.deepEqual(await runClickUpIntegration(setup), { statuses: [] });
  assert.deepEqual(setup.calls, ['schema']); assert.deepEqual(setup.commits, []);
  setup.product.config.clickup_list_id = 'production-list';
  await assert.rejects(runClickUpIntegration(setup), /QA|test/i);
  assert.deepEqual(setup.calls, ['schema']);
});

test('sync scopes all reads and commits only after complete snapshots and remote pagination', async () => {
  const setup = fixture();
  await runClickUpIntegration(setup);
  assert.equal(setup.commits.length, 1);
  assert.equal(setup.commits[0].name, 'apply_qa_clickup_sync');
  assert.equal(setup.commits[0].args.p_expected_updated_at, '2026-01-01');
  assert.deepEqual(setup.calls.filter(Array.isArray), ['ads', 'manual_actions', 'deleted_ads'].map((table) => [table, 'product_id', 'qa']));
});
test('failed tombstone reads stop before ClickUp and never commit', async () => {
  const setup = fixture('deleted_ads');
  await assert.rejects(runClickUpIntegration(setup), /deleted_ads/);
  assert.equal(setup.calls.includes('tasks'), false);
  assert.equal(setup.commits.length, 0);
});
test('preparing an automatic sync returns a versioned plan without a database write', async () => {
  const setup = fixture(); setup.input.prepareOnly = true;
  const result = await runClickUpIntegration(setup);
  assert.equal(result.productId, 'qa');
  assert.equal(result.listId, listId);
  assert.equal(result.productUpdatedAt, '2026-01-01');
  assert.ok(Array.isArray(result.plan.ads));
  assert.ok(Array.isArray(result.plan.actions));
  assert.equal(setup.commits.length, 0);
});
test('failed remote pagination never commits a partial import', async () => {
  const setup = fixture();
  setup.clickup.tasks = async () => { throw new Error('page 2 failed'); };
  await assert.rejects(runClickUpIntegration(setup), /page 2/);
  assert.equal(setup.commits.length, 0);
});
test('member cannot configure lists, admin uses atomic versioned settings RPC', async () => {
  const setup = fixture();
  setup.input = { operation: 'link', listId, mappings: { angle: 'angle' }, expectedUpdatedAt: 'captured-version' };
  await assert.rejects(runClickUpIntegration({ ...setup, profile: { role: 'member' } }), /administrator/);
  const result = await runClickUpIntegration(setup);
  assert.equal(setup.commits[0].name, 'save_qa_clickup_link');
  assert.equal(setup.commits[0].args.p_expected_updated_at, 'captured-version');
  assert.equal(result.productUpdatedAt, 'new-version');
});
test('unlinked task cannot be updated even if a caller knows its ClickUp id', async () => {
  const setup = fixture();
  setup.input = { operation: 'update-task', taskId: 'unknown', fields: { status: 'testing' } };
  await assert.rejects(runClickUpIntegration(setup), /not linked/);
});
test('link automatically detects fields without a mapping form and only saves QA configuration', async () => {
  const setup = fixture();
  setup.input = { operation: 'link', listId, expectedUpdatedAt: 'captured-version' };
  const result = await runClickUpIntegration(setup);
  assert.equal(result.mappings.angle, 'angle');
  assert.equal(setup.commits[0].args.p_mappings.angle, 'angle');
  assert.deepEqual(setup.calls, ['schema']);
});
test('a list without custom fields still links and imports basic task data', async () => {
  const setup = fixture();
  setup.clickup.inspect = async () => ({ list: { id: listId, name: 'Empty test list' }, fields: [] });
  setup.input = { operation: 'link', listId, expectedUpdatedAt: setup.product.updated_at };
  const linked = await runClickUpIntegration(setup);
  assert.equal(Object.values(linked.mappings).filter(Boolean).length, 0);
  setup.clickup.tasks = async () => [{ id: 'qa-task', name: 'QA test', list: { id: listId }, status: { status: 'in progress' } }];
  setup.input = { operation: 'sync' };
  await runClickUpIntegration(setup);
  const patch = setup.commits[1].args.p_plan.ads[0].patch;
  assert.equal(patch.format_name, 'QA test');
  assert.equal(patch.status, 'In Production');
});
test('sync redetects replaced custom field IDs instead of using stale mappings', async () => {
  const setup = fixture();
  setup.product.config.clickup_sync = { list_id: listId, mappings: { angle: 'old-field' } };
  setup.clickup.tasks = async () => [{ id: 'qa-task', name: 'QA test', list: { id: listId }, custom_fields: [{ id: 'angle', value: 'Current angle' }] }];
  await runClickUpIntegration(setup);
  assert.equal(setup.commits[0].args.p_plan.ads[0].patch.angle, 'Current angle');
});
test('non-approved lists are blocked before inspection or saving, even for administrators', async () => {
  const setup = fixture();
  setup.input = { operation: 'link', listId: '901613447211' };
  await assert.rejects(runClickUpIntegration(setup), /restricted/);
  assert.deepEqual(setup.calls, []);
  assert.deepEqual(setup.commits, []);
});
test('database pagination does not silently truncate local deletion history', async () => {
  const offsets = [];
  const db = { from() { return { select() { return this; }, eq() { return this; }, order() { return this; },
    range(from) { offsets.push(from); this.from = from; return this; },
    async abortSignal() { return { data: Array.from({ length: this.from === 0 ? 500 : 1 }, (_, id) => ({ id })) }; },
  }; } };
  assert.equal((await readProductRows(db, 'deleted_ads', 'qa')).length, 501);
  assert.deepEqual(offsets, [0, 500]);
});
