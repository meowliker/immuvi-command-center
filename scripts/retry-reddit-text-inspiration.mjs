import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {targetEnv} from './strategist-env.mjs';

const [insId, productId, output] = process.argv.slice(2);
assert.ok(insId && productId && output, 'Usage: retry-reddit-text-inspiration.mjs INS_ID PRODUCT_ID PRIVATE_OUTPUT [--apply]');
const {default: postgres} = await import(process.env.POSTGRES_MODULE || 'postgres');
const sql = postgres(targetEnv().STRATEGIST_DATABASE_URL, {max: 1, prepare: false, connect_timeout: 10});
mkdirSync(output, {recursive: true, mode: 0o700});
const record = (name, data) => writeFileSync(output + '/' + name + '.json', JSON.stringify(data, null, 2), {mode: 0o600, flag: 'wx'});
try {
  await sql.begin(async tx => {
    await tx`set local statement_timeout='15s'`;
    await tx`set local lock_timeout='5s'`;
    const inspirations = await tx`select * from public.inspirations where id=${insId} and product_id=${productId} for update`;
    const queues = await tx`select * from public.inspiration_queue where ins_id=${insId} and product_id=${productId} for update`;
    assert.equal(inspirations.length, 1);
    assert.equal(queues.length, 1);
    const inspiration = inspirations[0], queue = queues[0];
    const results = await tx`select * from public.inspiration_results where ins_id=${insId} and product_id=${productId}`;
    record('before', {inspiration, queue, results});
    assert.equal(results.length, 0, 'Do not overwrite a saved result');
    assert.equal(queue.url, inspiration.url, 'Source must match');
    const source = new URL(queue.url);
    assert.ok((source.hostname === 'reddit.com' || source.hostname.endsWith('.reddit.com')) && source.pathname.includes('/comments/'));
    assert.ok(['failed', 'blocked'].includes(queue.status) && !queue.claimed_by);
    assert.match(queue.error_message || '', /No downloadable creative media verified.*source is a Reddit text post/i);
    if (!process.argv.includes('--apply')) return;
    const workers = await tx`select worker_id,capabilities from public.worker_registry where enabled=true and last_heartbeat>now()-interval '2 minutes' and status in ('idle','busy')`;
    const worker = workers.find(w => w.capabilities?.reddit_text === 'reddit-text-v1' && /mini/i.test(w.worker_id));
    assert.ok(worker, 'Wait for a live Mac mini with the text-only contract');
    // Route only this retry to the verified worker; other queues are untouched.
    const changed = await tx`update public.inspiration_queue set status='pending',error_message=null,claimed_at=null,claimed_by=null,processed_at=null,worker_assignment=${worker.worker_id} where id=${queue.id} and product_id=${productId} and ins_id=${insId} and url=${queue.url} and status=${queue.status} and claimed_by is null returning *`;
    assert.equal(changed.length, 1);
    assert.deepEqual(changed[0], {...queue, status: 'pending', error_message: null, claimed_at: null, claimed_by: null, processed_at: null, worker_assignment: worker.worker_id});
    const current = (await tx`select * from public.inspirations where id=${insId} and product_id=${productId}`)[0];
    assert.deepEqual(current, inspiration, 'Recovery must preserve the inspiration');
    record('after', {queue: changed[0], inspirationUnchanged: true});
  });
  record('completed', {applied: process.argv.includes('--apply'), at: new Date().toISOString()});
  console.log('Recovery verified for ' + insId + '; applied=' + process.argv.includes('--apply'));
} finally { await sql.end(); }
