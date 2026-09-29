import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY } from '../lib/qa-supabase-env.js';
import { runAccountOperation } from '../lib/services/account-operations.js';
import { readAdminUsers } from '../lib/services/admin-access.js';
import { qaServiceKey } from './qa-service-config.mjs';

if (!process.argv.includes('--run')) throw new Error('Use --run to create and remove two disposable QA Auth accounts.');
if (readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== 'entgcnlfsnysnwyadzzp'
  || (process.env.QA_SUPABASE_URL && process.env.QA_SUPABASE_URL.replace(/\/$/, '') !== QA_SUPABASE_URL)) throw new Error('Refusing a non-QA project.');
const serviceKey = qaServiceKey({ fromCli: process.argv.includes('--cli-key') });
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const db = createClient(QA_SUPABASE_URL, serviceKey, options);
const actorDb = createClient(QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY, options);
const targetDb = createClient(QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY, options);
const runId = randomUUID(), actorId = randomUUID(), targetId = randomUUID();
const password = () => `Qa9!${randomBytes(20).toString('base64url')}`;
const actorPassword = password(), targetPassword = password(), changedPassword = password();
const account = (id) => `qa-account-e2e-${id}@example.test`;
const requestIds = [], cleanupErrors = [];
let stage = 'create-fixtures', failed = false;
const check = (result) => { if (result.error) throw new Error(`QA Auth acceptance failed at ${stage}.`); return result.data; };
async function request(operation) {
  const previousStage = stage; stage = `${operation}:read-users`;
  let users;
  try { users = await readAdminUsers(actorDb, new AbortController().signal); }
  catch {
    const diagnostic = await actorDb.rpc('qa_admin_users_page', { p_after: null });
    console.error(JSON.stringify({ userReadCode: diagnostic.error?.code, userReadMessage: diagnostic.error?.message,
      returnedRows: Array.isArray(diagnostic.data) ? diagnostic.data.length : null,
      missingRevisions: Array.isArray(diagnostic.data) ? diagnostic.data.filter((row) => !row.access_revision).length : null }));
    throw new Error('QA user snapshot acceptance failed.');
  }
  const target = users.find((row) => row.id === targetId);
  if (!target) throw new Error('Disposable target profile is missing.');
  const input = { requestId: randomUUID(), userId: targetId, operation, revision: target.access_revision, confirmEmail: operation === 'delete-user' ? account(targetId) : '' };
  requestIds.push(input.requestId); stage = previousStage; return input;
}
const baseIndex = process.argv.indexOf('--base-url');
const base = baseIndex >= 0 ? new URL(process.argv[baseIndex + 1]) : null;
if (base && (base.hostname !== '127.0.0.1' || base.protocol !== 'http:' || base.username || base.password || base.pathname !== '/')) throw new Error('Live route tests require the loopback QA server root.');
const run = async (input) => {
  if (!base) return runAccountOperation({ db, actorId, request: input, secretKey: process.env.QA_ACCOUNT_ENCRYPTION_KEY || serviceKey });
  const session = check(await actorDb.auth.getSession()).session;
  const response = await fetch(new URL(`/api/admin/${input.operation}`, base), { method: 'POST', redirect: 'error',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!response.ok || response.headers.get('cache-control') !== 'no-store') {
    console.error(`QA route status: ${response.status}; no-store: ${response.headers.get('cache-control') === 'no-store'}.`);
    throw new Error(`QA route acceptance failed at ${stage}.`);
  }
  return response.json();
};
try {
  for (const [id, credential, role] of [[actorId, actorPassword, 'admin'], [targetId, targetPassword, 'member']]) {
    const created = check(await db.auth.admin.createUser({ id, email: account(id), password: credential, email_confirm: true,
      app_metadata: { role, must_change_password: false, qa_test_run: runId } }));
    assert.equal(created.user.id, id);
    // Hosted Auth applies app metadata after its INSERT trigger. Provision only
    // this invocation's disposable profiles; creation recovery is a separate gate.
    check(await db.from('profiles').update({ role, must_change_password: false }).eq('id', id));
    const seededProfile = check(await db.from('profiles').select('role,is_active,must_change_password').eq('id', id).single());
    if (seededProfile.role !== role || !seededProfile.is_active || seededProfile.must_change_password) {
      console.error(JSON.stringify({ fixtureRole: role, trustedRole: created.user.app_metadata?.role, seededProfile }));
      throw new Error('Disposable profile authority does not match trusted metadata.');
    }
  }
  stage = 'administrator-sign-in'; check(await actorDb.auth.signInWithPassword({ email: account(actorId), password: actorPassword }));
  stage = 'reset'; const reset = await request('reset-password'), result = await run(reset);
  assert.equal(result.credentialsAvailable, true);
  assert.equal((await run(reset)).temp_password, result.temp_password);
  stage = 'temporary-password-sign-in'; check(await targetDb.auth.signInWithPassword({ email: account(targetId), password: result.temp_password }));
  assert.equal(check(await targetDb.from('profiles').select('must_change_password').eq('id', targetId).single()).must_change_password, true);
  stage = 'forced-password-completion'; check(await targetDb.auth.updateUser({ password: changedPassword }));
  const profile = check(await targetDb.from('profiles').select('must_change_password,last_login_at').eq('id', targetId).single());
  assert.equal(profile.must_change_password, false); assert.ok(profile.last_login_at);
  stage = 'reset-replay-after-password-change'; const replay = await run(reset);
  assert.equal(replay.credentialsAvailable, false); assert.equal(replay.temp_password, undefined);
  check(await targetDb.auth.signInWithPassword({ email: account(targetId), password: changedPassword }));
  stage = 'deactivate'; const deactivate = await request('deactivate'); assert.equal((await run(deactivate)).user.is_active, false);
  const banned = await targetDb.auth.signInWithPassword({ email: account(targetId), password: changedPassword }); assert.ok(banned.error);
  stage = 'reactivate'; assert.equal((await run(await request('reactivate'))).user.is_active, true);
  check(await targetDb.auth.signInWithPassword({ email: account(targetId), password: changedPassword }));
  stage = 'delete'; const remove = await request('delete-user'); assert.equal((await run(remove)).user, null); assert.equal((await run(remove)).user, null);
  const deleted = await db.auth.admin.getUserById(targetId); assert.equal(deleted.error?.status, 404);
  stage = 'audit'; const audit = check(await db.from('admin_audit_log').select('action,meta').eq('actor_id', actorId));
  assert.equal(audit.length, 4);
  assert.equal(audit.filter((row) => row.action === 'qa_account_delete_user').length, 1);
  console.log('Live QA Auth acceptance passed: reset/replay, forced password change, old-credential suppression, ban/unban, deletion/replay and one audit per operation.');
} catch (error) {
  failed = true; console.error(`Live QA Auth acceptance failed at ${stage} (${error?.name || 'Error'}); credentials have not been printed.`);
} finally {
  // Only this invocation's random identities and request IDs may be removed.
  for (const [table, column, values] of [['qa_account_operations','request_id',requestIds], ['admin_audit_log','actor_id',[actorId]]]) {
    if (values.length) {
      try { const result = await db.from(table).delete().in(column, values); if (result.error) throw result.error; }
      catch { cleanupErrors.push(table); }
    }
  }
  for (const id of [targetId, actorId]) {
    try {
      const found = await db.auth.admin.getUserById(id);
      if (found.error?.status === 404) continue;
      if (found.error || found.data.user?.email !== account(id) || found.data.user?.app_metadata?.qa_test_run !== runId) throw new Error('Fixture identity mismatch');
      if ((await db.auth.admin.deleteUser(id)).error) throw new Error('Fixture cleanup failed');
      if ((await db.auth.admin.getUserById(id)).error?.status !== 404) throw new Error('Fixture cleanup unverified');
    } catch { cleanupErrors.push(id); }
  }
  if (cleanupErrors.length) { failed = true; console.error(`QA fixture cleanup needs review: ${cleanupErrors.join(', ')}. Run ID: ${runId}; actor: ${actorId}; target: ${targetId}; requests: ${requestIds.join(', ')}.`); }
  else console.log('Disposable Auth accounts, operation journals and audit fixtures removed.');
  process.exitCode = failed ? 1 : 0;
}
