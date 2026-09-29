import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { qaServiceKey } from './qa-service-config.mjs';
import { QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY } from '../lib/qa-supabase-env.js';
import { privateWorkerHeaders } from '../lib/services/private-worker.js';

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(QA_SUPABASE_URL, qaServiceKey({ fromCli: true }), options);
const id = randomUUID(), product = `qa-private-api-${id}`, device = randomUUID(), token = randomBytes(32).toString('hex');
const users = [], runs = [];
const check = (result, label) => { if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data; };
try {
  check(await admin.from('products').insert({ id: product, name: 'Disposable private worker API fixture' }), 'Create product fixture');
  check(await admin.from('ads').insert({ id: product, product_id: product, format_name: 'Disposable fixture', meta: {} }), 'Create creative fixture');
  for (const suffix of ['owner', 'other-admin']) {
    const email = `private-worker-${id}-${suffix}@example.test`, password = randomBytes(24).toString('hex');
    const created = check(await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { must_change_password: false } }), 'Create user fixture');
    users.push({ id: created.user.id });
    // Hosted Auth inserts the profile before applying app_metadata. This fixture
    // is not an invited user and has no password-change workflow to complete.
    check(await admin.from('profiles').update({is_active:true,must_change_password:false}).eq('id',created.user.id), 'Activate fixture profile');
    const db = createClient(QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY, options);
    check(await db.auth.signInWithPassword({ email, password }), 'Sign in fixture');
    users.at(-1).db = db;
  }
  check(await admin.from('user_products').insert({ user_id: users[0].id, product_id: product }), 'Grant fixture product');
  check(await admin.from('profiles').update({ role: 'admin' }).eq('id', users[1].id), 'Set other fixture admin');
  check(await admin.from('qa_private_workers').insert({ id: device, owner_id: users[0].id, name: 'Disposable API worker',
    token_hash: createHash('sha256').update(token).digest('hex') }), 'Pair fixture');
  const worker = createClient(QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY, { ...options, global: { headers: privateWorkerHeaders({id:device,token}) } });
  const heartbeat = check(await worker.rpc('qa_private_worker_heartbeat', { p_available: true }), 'Device heartbeat');
  assert.equal(heartbeat.ownerId, users[0].id);
  const owner = users[0].db, other = users[1].db;
  assert.equal(check(await owner.rpc('qa_private_workers_list'), 'Owner list').length, 1);
  assert.deepEqual(check(await other.rpc('qa_private_workers_list'), 'Other admin list'), []);
  assert.ok((await other.rpc('qa_private_worker_set_enabled', { p_id: device, p_enabled: false })).error);
  const params = { p_request_id: randomUUID(), p_product_id: product, p_ad_id: product,
    p_options: { count: 1, instruction: 'API permissions fixture, no generation', referenceUrl: '', referenceIds: [], productName: 'Fixture', offer: '', market: '', forbiddenAliases: '' } };
  assert.ok((await other.rpc('qa_generate_images', params)).error);
  const queued = check(await owner.rpc('qa_generate_images', params), 'Owner enqueue'); runs.push(queued.id);
  assert.equal(queued.requested_by, users[0].id); assert.equal(queued.private_worker_id, device);
  const run = check(await worker.rpc('qa_private_image_claim'), 'Device claim');
  assert.equal(run.id, queued.id); assert.equal(check(await worker.rpc('qa_private_image_claim'), 'Second claim'), null);
  const upload = createClient(QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY, { ...options, global: { headers: privateWorkerHeaders({id:device,token},run.lease_id) } });
  const bytes = await sharp({create:{width:256,height:256,channels:3,background:'#ffffff'}}).png().toBuffer();
  assert.ok((await upload.storage.from('qa-producer-images').upload(`${run.id}/2.png`,bytes,{contentType:'image/png'})).error);
  check(await upload.storage.from('qa-producer-images').upload(`${run.id}/1.png`,bytes,{contentType:'image/png'}), 'Lease-scoped upload');
  const args = { p_id: run.id, p_lease: run.lease_id, p_outputs: [{path:`${run.id}/1.png`,bucket:'qa-producer-images'}] };
  assert.equal(check(await worker.rpc('qa_private_image_finish', args), 'Finish'), 'done');
  assert.equal(check(await worker.rpc('qa_private_image_finish', args), 'Idempotent finish'), 'done');
  assert.ok((await upload.storage.from('qa-producer-images').upload(`${run.id}/1.png`,bytes,{contentType:'image/png',upsert:true})).error);
  console.log('Real QA API passed: owner-only visibility, other-admin denial, enqueue/claim, scoped storage upload, completion and retry. No generation or ClickUp calls.');
} finally {
  for (const run of runs) check(await admin.storage.from('qa-producer-images').remove([`${run}/1.png`,`${run}/2.png`]), 'Cleanup fixture uploads');
  check(await admin.from('qa_image_runs').delete().eq('product_id', product), 'Cleanup fixture runs');
  check(await admin.from('qa_private_workers').delete().eq('id', device), 'Cleanup fixture worker');
  check(await admin.from('ads').delete().eq('product_id', product), 'Cleanup fixture creative');
  check(await admin.from('products').delete().eq('id', product), 'Cleanup fixture product');
  for (const user of users) check(await admin.auth.admin.deleteUser(user.id), 'Cleanup fixture user');
  console.log('Disposable API fixtures removed.');
}
