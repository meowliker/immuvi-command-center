import test from 'node:test';
import assert from 'node:assert/strict';
import { runAccountOperation, sealAccountPassword, openAccountPassword } from '../../lib/services/account-operations.js';
import { validateAccountRequest, verifyAccountResult } from '../../lib/domain/account-operations.js';
import { QA_SUPABASE_URL } from '../../lib/qa-supabase-env.js';
const actor = '11111111-1111-4111-8111-111111111111', target = '22222222-2222-4222-8222-222222222222';
const request = { requestId: '33333333-3333-4333-8333-333333333333', userId: target, operation: 'reset-password', revision: 'a'.repeat(32), confirmEmail: '' };
const secret = 'unit-test-server-key';
function fixture() {
  const state = { job: null, writes: [], applied: false, failFinish: false, loseAuthReply: false, rejectAuth: false, changedPassword: false, neverArrived: false };
  const db = { supabaseUrl: QA_SUPABASE_URL, auth: { admin: {
    getUserById: async () => ({ data: { user: { id: target, app_metadata: { existing: 'preserve' } } } }),
    updateUserById: async (id, payload) => {
      state.writes.push({ id, payload });
      if (state.rejectAuth) return { error: { status: 422, message: 'SENSITIVE PROVIDER BODY' } };
      state.applied = !state.neverArrived;
      if (state.loseAuthReply) throw new Error('SENSITIVE NETWORK BODY');
      return { data: { user: { id } } };
    },
    deleteUser: async (id) => { state.writes.push({ id }); state.applied = true; return { data: { user: { id } } }; },
  } }, rpc: async (name, input) => {
    if (name === 'qa_account_prepare') {
      if (state.job) return { data: { ...state.job, canSend: false } };
      state.job = { request_id: input.p_request_id, target_id: target, actor_id: actor, operation: input.p_input.operation, secret_cipher: input.p_secret_cipher, state: 'sending' };
      return { data: { ...state.job, canSend: true } };
    }
    if (name === 'qa_account_reject') { state.job.state = 'rejected'; return { data: null }; }
    if (state.failFinish) { state.failFinish = false; return { error: { message: 'SENSITIVE DATABASE BODY' } }; }
    if (!state.applied) return { data: { state: 'uncertain', requestId: request.requestId } };
    state.job.state = 'completed';
    return { data: { state: 'completed', requestId: input.p_request_id, userId: target, operation: state.job.operation, dispatchEnabled: false,
      credentialsAvailable: state.job.operation === 'reset-password' && !state.changedPassword,
      user: state.job.operation === 'delete-user' ? null : { id: target, access_revision: 'b'.repeat(32), is_active: state.job.operation !== 'deactivate', must_change_password: true } } };
  } };
  const run = (override = {}) => runAccountOperation({ db, actorId: actor, request: { ...request, ...override }, secretKey: secret });
  return { state, db, run };
}
test('encrypted reset credentials are bound to request identity and server key', () => {
  const sealed = sealAccountPassword('Only-a-test-password', secret, request.requestId);
  assert.ok(!sealed.includes('Only-a-test-password'));
  assert.equal(openAccountPassword(sealed, secret, request.requestId), 'Only-a-test-password');
  assert.throws(() => openAccountPassword(sealed, 'wrong-key', request.requestId));
  assert.throws(() => openAccountPassword(sealed, secret, actor));
});
test('reset preserves metadata and replays original credential without another Auth mutation', async () => {
  const { run, state } = fixture();
  const result = await run(); verifyAccountResult(result, request);
  assert.equal(state.writes[0].payload.app_metadata.existing, 'preserve');
  assert.equal(state.writes[0].payload.password, result.temp_password);
  assert.equal((await run()).temp_password, result.temp_password); assert.equal(state.writes.length, 1);
  state.changedPassword = true;
  assert.equal((await run()).temp_password, undefined); assert.equal(state.writes.length, 1);
});
test('lost Auth response is reconciled and failed local finalize recovers without resetting twice', async () => {
  const { run, state } = fixture(); state.loseAuthReply = true; state.failFinish = true;
  await assert.rejects(run(), (error) => !error.definite && !error.message.includes('SENSITIVE'));
  verifyAccountResult(await run(), request); assert.equal(state.writes.length, 1);
});
test('unconfirmed writes stay blocked rather than blindly resending; definite rejection releases reservation', async () => {
  const { run, state } = fixture(); state.neverArrived = true; state.loseAuthReply = true;
  await assert.rejects(run(), /not confirmed/); await assert.rejects(run(), /not confirmed/); assert.equal(state.writes.length, 1);
  const rejected = fixture(); rejected.state.rejectAuth = true;
  await assert.rejects(rejected.run(), { definite: true });
  await assert.rejects(rejected.run(), { definite: true }); assert.equal(rejected.state.writes.length, 1);
});
test('activity changes and deletion have scoped replay and never return reset credentials', async () => {
  for (const operation of ['deactivate','reactivate','delete-user']) {
    const { run, state } = fixture(), input = { ...request, operation, confirmEmail: 'target@example.test' };
    const result = await run(input); verifyAccountResult(result, input);
    assert.equal(result.temp_password, undefined); await run(input); assert.equal(state.writes.length, 1);
    if (operation !== 'delete-user') assert.equal(state.writes[0].payload.ban_duration, operation === 'deactivate' ? '876600h' : 'none');
  }
});
test('request and result validation reject unrelated identities, unsafe inputs and incomplete acknowledgements', async () => {
  for (const invalid of [{ ...request, userId: 'id/path' }, { ...request, operation: 'create-user' }, { ...request, revision: '' }, { ...request, password: 'not-allowed' }]) assert.throws(() => validateAccountRequest(invalid));
  const { run, db } = fixture(); const result = await run();
  for (const invalid of [null, {}, { ...result, userId: actor }, { ...result, dispatchEnabled: true }, { ...result, temp_password: undefined }]) assert.throws(() => verifyAccountResult(invalid, request));
  db.supabaseUrl = 'https://hdniumnkprkadlrrataz.supabase.co'; await assert.rejects(run(), { definite: true });
});
