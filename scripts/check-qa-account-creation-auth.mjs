import { randomUUID, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY } from '../lib/qa-supabase-env.js';
import { qaServiceKey } from './qa-service-config.mjs';
import { creationRecoveryRequest, verifyAccountCreation } from '../lib/domain/account-creation.js';

if (!process.argv.includes('--run')) throw new Error('Use --run for disposable QA account creation acceptance.');
const index = process.argv.indexOf('--base-url');
if (index < 0) throw new Error('A running loopback QA server --base-url is required.');
const base = new URL(process.argv[index + 1]);
if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || base.pathname !== '/' || base.username || base.password) throw new Error('Only the loopback QA server root is allowed.');
const serviceKey = qaServiceKey({ fromCli: process.argv.includes('--cli-key') });
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const db = createClient(QA_SUPABASE_URL, serviceKey, options), actorDb = createClient(QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY, options);
const actorId = randomUUID(), runId = randomUUID(), productId = `qa-creation-e2e-${runId}`;
const email = (id) => `qa-creation-e2e-${id}@example.test`, password = () => `Qa9!${randomBytes(20).toString('base64url')}`;
const actorPassword = password(), requests = [], targets = new Map(), cleanupErrors = [];
let stage = 'fixtures', failed = false;
const check = (result) => { if (result.error) throw new Error('QA fixture request failed.'); return result.data; };
async function run(input, expectedStatus = 200) {
  const session = check(await actorDb.auth.getSession()).session;
  const response = await fetch(new URL('/api/admin/create-user', base), { method: 'POST', redirect: 'error',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  assert.equal(response.status, expectedStatus); assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = await response.json(); return expectedStatus === 200 ? verifyAccountCreation(result, input) : result;
}
try {
  const actor = check(await db.auth.admin.createUser({ id: actorId, email: email(actorId), password: actorPassword, email_confirm: true,
    app_metadata: { qa_test_run: runId } })); assert.equal(actor.user.id, actorId);
  check(await db.from('profiles').update({ role: 'admin', must_change_password: false }).eq('id', actorId));
  check(await db.from('products').insert({ id: productId, name: productId, config: {} }));
  check(await actorDb.auth.signInWithPassword({ email: email(actorId), password: actorPassword }));
  for (const role of ['member','admin']) {
    stage = `create-${role}`;
    const requestId = randomUUID();
    const input = { requestId, email: email(requestId), username: `fixture-${role}`, fullName: 'Disposable QA creation test', role,
      productIds: role === 'member' ? [productId] : [], passwordMode: role === 'member' ? 'custom' : 'generated',
      ...(role === 'member' ? { tempPassword: password() } : {}) };
    requests.push(input);
    const created = await run(input); targets.set(created.userId, input);
    assert.equal(created.user.role, role); assert.equal(created.user.must_change_password, true);
    assert.deepEqual(created.user.product_ids, input.productIds);
    const replay = await run(creationRecoveryRequest(input));
    assert.equal(replay.userId, created.userId); assert.equal(replay.temp_password, created.temp_password);
    if (input.tempPassword) assert.equal(created.temp_password, input.tempPassword);
    stage = `duplicate-${role}`;
    const duplicate = { ...input, requestId: randomUUID() }; requests.push(duplicate);
    assert.equal((await run(duplicate, 400)).definite, true);
    const usernameRequestId = randomUUID(), duplicateUsername = { ...input, requestId: usernameRequestId, email: email(usernameRequestId) };
    requests.push(duplicateUsername);
    assert.equal((await run(duplicateUsername, 400)).definite, true);
    stage = `password-${role}`;
    const targetDb = createClient(QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY, options);
    check(await targetDb.auth.signInWithPassword({ email: input.email, password: created.temp_password }));
    assert.equal(check(await targetDb.rpc('has_product', { p: productId })), false);
    assert.equal(check(await targetDb.rpc('is_admin')), false);
    check(await targetDb.auth.updateUser({ password: password() }));
    assert.equal(check(await targetDb.rpc('has_product', { p: productId })), true);
    assert.equal(check(await targetDb.rpc('is_admin')), role === 'admin');
    const changed = await run(creationRecoveryRequest(input)); assert.equal(changed.credentialsAvailable, false); assert.equal(changed.temp_password, undefined);
  }
  stage = 'audit';
  const audit = check(await db.from('admin_audit_log').select('action').eq('actor_id', actorId));
  assert.equal(audit.length, 2); assert.ok(audit.every((row) => row.action === 'qa_account_create_user'));
  console.log('Live QA account creation passed: member/custom password, admin/generated password, exact replay, duplicate email/username rejection, product access, forced password completion, credential suppression and one audit per creation.');
} catch (error) {
  failed = true; console.error(`Live QA creation failed at ${stage} (${error?.name || 'Error'}); no credentials printed.`);
} finally {
  // Discover only this run's reserved UUIDs before deleting their journal rows.
  try {
    const jobs = requests.length ? check(await db.from('qa_account_creations').select('target_id,request_id').in('request_id', requests.map((r) => r.requestId))) : [];
    for (const job of jobs) targets.set(job.target_id, requests.find((r) => r.requestId === job.request_id));
    if (requests.length) check(await db.from('qa_account_creations').delete().in('request_id', requests.map((r) => r.requestId)));
    check(await db.from('admin_audit_log').delete().eq('actor_id', actorId));
  } catch { cleanupErrors.push('journals/audit'); }
  for (const [id, input] of [...targets, [actorId, null]]) {
    try {
      const found = await db.auth.admin.getUserById(id);
      if (found.error?.status === 404) continue;
      const user = check(found).user;
      if (user.email !== (input ? input.email : email(actorId)) || (input ? user.app_metadata?.qa_creation_request !== input.requestId : user.app_metadata?.qa_test_run !== runId)) throw new Error('Fixture identity mismatch');
      check(await db.auth.admin.deleteUser(id));
      assert.equal((await db.auth.admin.getUserById(id)).error?.status, 404);
    } catch { cleanupErrors.push(id); }
  }
  try { check(await db.from('products').delete().eq('id', productId)); }
  catch { cleanupErrors.push(productId); }
  if (cleanupErrors.length) { failed = true; console.error(`Fixture cleanup needs review: ${cleanupErrors.join(', ')}; actor ${actorId}; requests ${requests.map((r) => r.requestId).join(', ')}.`); }
  else console.log('Disposable Auth accounts, product, journals and audit fixtures removed.');
  process.exitCode = failed ? 1 : 0;
}
