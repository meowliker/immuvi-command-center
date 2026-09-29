import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY } from '../lib/qa-supabase-env.js';
import { qaServiceKey } from './qa-service-config.mjs';

if (!process.argv.includes('--run') || execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim() !== 'qa') {
  throw new Error('Use --run on qa for disposable live permission/concurrency fixtures.');
}
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const db = createClient(QA_SUPABASE_URL, qaServiceKey({ fromCli: process.argv.includes('--cli-key') }), options);
const client = () => createClient(QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY, options);
const runId = randomUUID(), own = `qa-boundary-${runId}`, foreign = `${own}-foreign`;
const adId = `${own}-ad`, foreignAd = `${foreign}-ad`, angle = `${own}-angle`, persona = `${own}-persona`;
const users = [], cleanupErrors = [];
let stage = 'fixtures', failed = false;
function check(result) {
  if (result.error) throw new Error(`QA request failed (${result.error.code || result.error.status || 'unknown'}).`);
  return result.data;
}
async function account(role, forced = false) {
  const id = randomUUID(), email = `qa-boundary-${id}@example.test`, password = `Qa9!${randomBytes(24).toString('base64url')}`;
  users.push({ id, email });
  assert.equal(check(await db.auth.admin.createUser({ id, email, password, email_confirm: true, app_metadata: { qa_test_run: runId } })).user.id, id);
  check(await db.from('profiles').update({ role, must_change_password: forced }).eq('id', id));
  const session = client();
  check(await session.auth.signInWithPassword({ email, password }));
  return { id, email, password, session };
}
try {
  check(await db.from('products').insert([own, foreign].map((id) => ({ id, name: id, config: { qa_test_run: runId } }))));
  const member = await account('member'), other = await account('member'), admin = await account('admin'), forced = await account('member', true);
  check(await db.from('user_products').insert([
    { user_id: member.id, product_id: own }, { user_id: other.id, product_id: foreign }, { user_id: forced.id, product_id: own },
  ]));
  check(await db.from('ads').insert([{ id: adId, product_id: own, format_name: 'Initial' }, { id: foreignAd, product_id: foreign, format_name: 'Foreign' }]));
  check(await db.from('angles').insert({ id: angle, product_id: own, name: 'Boundary angle' }));
  check(await db.from('personas').insert({ id: persona, product_id: own, name: 'Boundary persona' }));
  check(await db.from('manual_actions').insert({ product_id: own, payload: { sourceAdId: adId, title: 'Initial' } }));
  check(await db.from('task_video_winners').insert({ ad_id: foreignAd, drive_file_id: runId, file_name: 'Foreign artifact' }));
  stage = 'real-jwt-product-isolation';
  assert.ok((await client().from('ads').select('id').eq('id', adId)).error);
  assert.deepEqual(check(await member.session.from('ads').select('id').in('id', [adId, foreignAd])), [{ id: adId }]);
  assert.deepEqual(check(await member.session.from('task_video_winners').select('id').eq('ad_id', foreignAd)), []);
  assert.deepEqual(check(await other.session.from('ads').update({ format_name: 'Forbidden' }).eq('id', adId).select('id')), []);
  assert.ok((await other.session.rpc('qa_tracker_access', { p_product_id: own })).error);
  assert.deepEqual(check(await member.session.from('products').update({ name: 'Forbidden' }).eq('id', own).select('id')), []);
  assert.equal(check(await admin.session.from('products').select('id').in('id', [own, foreign])).length, 2);
  assert.deepEqual(check(await forced.session.from('ads').select('id').eq('id', adId)), []);
  assert.equal(check(await forced.session.from('profiles').select('id').eq('id', forced.id)).length, 1);
  check(await forced.session.auth.updateUser({ password: `Qa9!${randomBytes(24).toString('base64url')}` }));
  assert.equal(check(await forced.session.from('ads').select('id').eq('id', adId)).length, 1);
  stage = 'concurrent-tracker-and-action-plan';
  const secondSession = client();
  check(await secondSession.auth.signInWithPassword({ email: member.email, password: member.password }));
  for (let round = 0; round < 5; round++) {
    const before = check(await member.session.from('ads').select('updated_at').eq('id', adId).single());
    const attempts = await Promise.all([member.session, secondSession].map((session, index) => session.rpc('qa_tracker_save', {
      p_product_id: own, p_ad_id: adId, p_expected_updated_at: before.updated_at,
      p_values: { format_name: `Race ${round}/${index}` }, p_custom: {},
    })));
    assert.equal(attempts.filter((result) => !result.error).length, 1);
    assert.match(attempts.find((result) => result.error).error.message, /Creative changed/);
    const after = check(await db.from('ads').select('format_name').eq('id', adId).single());
    const action = check(await db.from('manual_actions').select('payload').eq('product_id', own).single());
    assert.equal(action.payload.title, after.format_name);
  }
  stage = 'concurrent-matrix-replay';
  const request = { p_product_id: own, p_angle_id: angle, p_persona_id: persona, p_kind: 'blank', p_items: [{ name: 'Concurrent brief' }], p_request_id: randomUUID() };
  const results = await Promise.all([member.session, secondSession].map((session) => session.rpc('qa_matrix_create', request)));
  assert.deepEqual(check(results[0]), check(results[1]));
  assert.equal(results[0].data.length, 1);
  assert.equal(check(await db.from('ads').select('id').eq('product_id', own).eq('meta->>_matrixRequestId', request.p_request_id)).length, 1);
  stage = 'active-token-revocation';
  check(await db.from('profiles').update({ is_active: false }).eq('id', member.id));
  for (const session of [member.session, secondSession]) {
    assert.deepEqual(check(await session.from('ads').select('id').eq('id', adId)), []);
    assert.ok((await session.rpc('qa_tracker_access', { p_product_id: own })).error);
  }
  console.log('Live QA passed: anonymous/member/admin/forced-password access, foreign reads/writes/artifacts, admin-only settings, five two-session edit races with Action Plan consistency, concurrent Matrix replay, and immediate revocation of both sessions.');
} catch (error) {
  failed = true;
  console.error(`Live QA boundary check failed at ${stage}: ${error.name}; no credentials printed.`);
} finally {
  for (const id of [own, foreign]) {
    try {
      const product = check(await db.from('products').select('config').eq('id', id).maybeSingle());
      if (!product) continue;
      assert.equal(product.config.qa_test_run, runId);
      const ids = check(await db.from('ads').select('id').eq('product_id', id)).map((row) => row.id);
      if (ids.length) check(await db.from('task_video_winners').delete().in('ad_id', ids));
      for (const table of ['manual_actions','matrix_cells','ads','angles','personas','user_products']) check(await db.from(table).delete().eq('product_id', id));
      check(await db.from('products').delete().eq('id', id));
      assert.equal(check(await db.from('products').select('id').eq('id', id)).length, 0);
    } catch { cleanupErrors.push(id); }
  }
  for (const { id, email } of users) {
    try {
      const found = await db.auth.admin.getUserById(id);
      if (found.error?.status === 404) continue;
      const user = check(found).user;
      assert.equal(user.email, email); assert.equal(user.app_metadata.qa_test_run, runId);
      check(await db.auth.admin.deleteUser(id));
      assert.equal((await db.auth.admin.getUserById(id)).error?.status, 404);
    } catch { cleanupErrors.push(id); }
  }
  if (cleanupErrors.length) { failed = true; console.error(`Fixture cleanup needs review: ${cleanupErrors.join(', ')}`); }
  else console.log('All disposable users, products and creative fixtures removed.');
  process.exitCode = failed ? 1 : 0;
}
