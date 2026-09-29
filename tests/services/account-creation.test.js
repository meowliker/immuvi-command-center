import test from 'node:test';
import assert from 'node:assert/strict';
import { runAccountCreation } from '../../lib/services/account-creation.js';
import { validateAccountCreation, creationRecoveryRequest, verifyAccountCreation } from '../../lib/domain/account-creation.js';
import { QA_SUPABASE_URL } from '../../lib/qa-supabase-env.js';
const actor = '11111111-1111-4111-8111-111111111111';
const request = { requestId: '33333333-3333-4333-8333-333333333333', email: 'new@example.test', username: 'new', fullName: 'New Person', role: 'member', productIds: ['qa'], passwordMode: 'custom', tempPassword: 'Fixture-Password-123' };
function fixture() {
  let job, authUser, response; const writes = [], calls = []; const control = {};
  const db = { supabaseUrl: QA_SUPABASE_URL, auth: { admin: { async createUser(input) {
    writes.push(input); if (control.reject) return { error: { status: 422 } };
    authUser = input; if (control.authLost) throw new Error('lost Auth acknowledgement');
    return { data: { user: input } };
  } } }, async rpc(name, input) {
    calls.push({ name, input });
    if (name === 'qa_account_creation_prepare') {
      if (!job) { job = { request_id: input.p_request_id, target_id: input.p_target, actor_id: input.p_actor, state: 'sending', secret_cipher: input.p_secret_cipher }; return { data: { ...job, canSend: true } }; }
      return { data: { ...job, canSend: false } };
    }
    if (name === 'qa_account_creation_reject') { job.state = 'rejected'; return {}; }
    if (control.finishLost) { control.finishLost = false; return { error: { message: 'lost' } }; }
    if (!authUser || control.uncertain) return { data: { state: 'uncertain' } };
    response ||= { state: 'completed', requestId: request.requestId, userId: job.target_id, email: request.email, operation: 'create-user', dispatchEnabled: false,
      user: { id: job.target_id, access_revision: 'a'.repeat(32) } };
    job.state = 'completed';
    return { data: { ...response, ...(control.wrongTarget ? { userId: actor, user: { id: actor, access_revision: 'a'.repeat(32) } } : {}), credentialsAvailable: !control.passwordChanged } };
  } };
  return { db, writes, calls, control, run: (input = request) => runAccountCreation({ db, actorId: actor, request: input, secretKey: 'fixture-secret' }) };
}
test('creation validates safe identity and drops only plaintext from recovery storage', () => {
  assert.equal(validateAccountCreation(request), request);
  assert.equal(creationRecoveryRequest(request).tempPassword, undefined);
  for (const patch of [{ email: 'NEW@example.test' }, { role: 'owner' }, { role: 'admin' }, { productIds: ['qa','qa'] }, { tempPassword: 'short' }, { tempPassword: 'x'.repeat(73) }, { username: ' x ' }, { extra: true }]) {
    assert.throws(() => validateAccountCreation({ ...request, ...patch }));
  }
});
test('creation reserves encrypted secrets before a single Auth call and replays original credentials without browser plaintext', async () => {
  const f = fixture(), result = await f.run();
  assert.equal(result.temp_password, request.tempPassword);
  assert.equal((await f.run(creationRecoveryRequest(request))).temp_password, request.tempPassword);
  assert.equal(f.writes.length, 1); assert.equal(f.writes[0].id, result.userId);
  assert.equal(f.writes[0].app_metadata.qa_creation_request, request.requestId);
  assert.equal(f.writes[0].app_metadata.role, 'member');
  assert.ok(!JSON.stringify(f.calls).includes(request.tempPassword));
  assert.equal(f.calls[0].input.p_input.passwordMode, 'custom');
});
test('lost Auth acknowledgement and lost local finish reconcile without another creation', async () => {
  const f = fixture(); f.control.authLost = true; f.control.finishLost = true;
  await assert.rejects(f.run(), /provisioning is unconfirmed/);
  assert.equal((await f.run(creationRecoveryRequest(request))).state, 'completed'); assert.equal(f.writes.length, 1);
  f.control.passwordChanged = true;
  const result = await f.run(creationRecoveryRequest(request)); assert.equal(result.credentialsAvailable, false); assert.equal(result.temp_password, undefined);
});
test('uncertain creation stays pending, definite Auth rejection releases it, and malformed results are never success', async () => {
  const f = fixture(); f.control.uncertain = true;
  await assert.rejects(f.run(), /not confirmed/); await assert.rejects(f.run(creationRecoveryRequest(request)), /not confirmed/); assert.equal(f.writes.length, 1);
  const g = fixture(); g.control.reject = true; await assert.rejects(g.run(), (e) => e.definite);
  await assert.rejects(g.run(), /was rejected/); assert.equal(g.writes.length, 1);
  assert.throws(() => verifyAccountCreation({ state: 'completed' }, request), /could not be verified/);
  const h = fixture(); h.control.wrongTarget = true; await assert.rejects(h.run(), /reserved account/);
});
test('creation refuses production before any call and generated passwords meet the same receipt checks', async () => {
  const f = fixture(); f.db.supabaseUrl = 'https://hdniumnkprkadlrrataz.supabase.co';
  await assert.rejects(f.run(), /approved QA/); assert.equal(f.calls.length, 0);
  const g = fixture(); const { tempPassword, ...input } = request;
  const result = await g.run({ ...input, passwordMode: 'generated' }); assert.ok(result.temp_password.length >= 20);
});
