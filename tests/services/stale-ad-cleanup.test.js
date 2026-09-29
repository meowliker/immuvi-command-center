import test from 'node:test';
import assert from 'node:assert/strict';
import { runStaleAdCleanup } from '../../lib/services/stale-ad-cleanup.js';
import { cleanupTaskIds, validateCleanupRequest, verifyCleanupReceipt, CLEANUP_LIST } from '../../lib/domain/stale-ad-cleanup.js';
import { QA_SUPABASE_URL } from '../../lib/qa-supabase-env.js';
const actorId = '11111111-1111-4111-8111-111111111111', previewId = '22222222-2222-4222-8222-222222222222';
const input = { operation: 'commit', productId: 'qa', requestId: '33333333-3333-4333-8333-333333333333', previewId, confirmName: 'QA' };
function fixture() {
  const calls = [], control = {};
  const receipt = { ...input, deletedIds: ['stale'], dispatchEnabled: false };
  const db = { supabaseUrl: QA_SUPABASE_URL, from() { return { select() { return this; }, eq() { return this; }, async single() { return { data: { id: 'qa', updated_at: '2026-09-25T00:00:00Z', config: { clickup_list_id: control.list || CLEANUP_LIST } } }; } }; },
    async rpc(name, args) { calls.push({ name, args });
      if (control.error) return { error: control.error };
      if (name === 'qa_stale_cleanup_receipt') return { data: control.saved ? receipt : null };
      if (name === 'qa_stale_cleanup_preview') return { data: { productId: 'qa', previewId, productName: 'QA', listId: CLEANUP_LIST, remoteCount: 1, candidates: [], protected: { local: 1 }, expiresAt: new Date().toISOString(), dispatchEnabled: false } };
      control.saved = true;
      if (control.lost) { control.lost = false; return { error: { code: 'network', message: 'lost' } }; }
      return { data: receipt };
    } };
  const clickup = { async inspect(id) { assert.equal(id, CLEANUP_LIST); calls.push({ name: 'inspect' }); }, async tasks(id, options) {
    assert.deepEqual(options, { includeArchived: true, requireExplicitEnd: true }); calls.push({ name: 'tasks' });
    if (control.remoteError) throw new Error('ClickUp incomplete');
    return control.tasks || [{ id: 'current', list: { id } }];
  } };
  return { control, calls, db, run: (request = input) => runStaleAdCleanup({ db, actorId, input: request, makeClickUp() { if (control.noKey) throw new Error('No key'); return clickup; } }) };
}
test('cleanup validates identifiers, boundary, nonempty complete snapshots and receipt identity', () => {
  assert.equal(validateCleanupRequest(input), input);
  assert.throws(() => validateCleanupRequest({ ...input, taskIds: ['forged'] }));
  for (const value of [[], [{ id: 'a', list: { id: 'production' } }], [{ id: 'a', list: { id: CLEANUP_LIST } }, { id: 'a', list: { id: CLEANUP_LIST } }]]) assert.throws(() => cleanupTaskIds(value));
  assert.throws(() => verifyCleanupReceipt({ ...input, productId: 'other', deletedIds: [], dispatchEnabled: false }, input));
});
test('preview and commit require fresh archived-inclusive ClickUp reads before their server-only RPC', async () => {
  const f = fixture(); await f.run({ operation: 'preview', productId: 'qa' });
  assert.deepEqual(f.calls.map((c) => c.name), ['inspect','tasks','qa_stale_cleanup_preview']);
  f.calls.length = 0; await f.run();
  assert.deepEqual(f.calls.map((c) => c.name), ['qa_stale_cleanup_receipt','inspect','tasks','qa_stale_cleanup_commit']);
  assert.deepEqual(f.calls.at(-1).args.p_task_ids, ['current']);
});
test('lost cleanup acknowledgement recovers the exact receipt without another remote read or mutation', async () => {
  const f = fixture(); f.control.lost = true;
  await assert.rejects(f.run(), (e) => !e.definite);
  f.control.noKey = true; const result = await f.run(); assert.deepEqual(result.deletedIds, ['stale']);
  assert.equal(f.calls.filter((c) => c.name === 'tasks').length, 1);
  assert.equal(f.calls.filter((c) => c.name === 'qa_stale_cleanup_commit').length, 1);
});
test('empty, failed and foreign snapshots or production destinations never reach the cleanup commit', async () => {
  for (const control of [{ tasks: [] }, { remoteError: true }, { list: 'production' }, { tasks: [{ id: 'a', list: { id: 'production' } }] }]) {
    const f = fixture(); Object.assign(f.control, control); await assert.rejects(f.run());
    assert.equal(f.calls.some((c) => c.name === 'qa_stale_cleanup_commit'), false);
  }
  const f = fixture(); f.db.supabaseUrl = 'https://hdniumnkprkadlrrataz.supabase.co'; await assert.rejects(f.run(), /approved QA/); assert.equal(f.calls.length, 0);
});
test('database conflicts are definite and do not report success', async () => {
  const f = fixture(); f.control.error = { code: 'P0001', message: 'Product work changed since preview' };
  await assert.rejects(f.run(), (e) => e.definite && /changed/.test(e.message));
});
