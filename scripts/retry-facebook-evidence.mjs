import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {targetEnv} from './strategist-env.mjs';

const targets = {
  'ARI-INS-224': ['f2ca61dd-6d6f-4be7-90cc-564e3984310f', '1702836164344299', /1702836164344299.*verified/i],
  'ARI-INS-299': ['f7fee969-dfa1-4814-aead-e53ceb5cd1f1', '948752717726862', /948752717726862.*verified/i],
  'ARI-INS-300': ['068f213e-5c84-47ff-8ff4-8a18c735b839', '1637860551468584', /Mongolian narration could not be verified/i],
};
const [insId, output] = process.argv.slice(2);
assert.ok(targets[insId] && output?.startsWith('/'), 'Use an audited inspiration ID and private absolute backup directory');
const productId = 'prod-1778009469915';
const {default: postgres} = await import(process.env.POSTGRES_MODULE || 'postgres');
const sql = postgres(targetEnv().STRATEGIST_DATABASE_URL, {max: 1, prepare: false, ssl: 'require', connect_timeout: 10});
mkdirSync(output, {recursive: true, mode: 0o700});
const record = (name, data) => writeFileSync(`${output}/${name}.json`, JSON.stringify(data, null, 2), {mode: 0o600, flag: 'wx'});
try {
  await sql.begin(async tx => {
    await tx`set local statement_timeout='15s'`;
    await tx`set local lock_timeout='5s'`;
    const inspirations = await tx`select * from inspirations where id=${insId} and product_id=${productId} for update`;
    const queues = await tx`select * from inspiration_queue where id=${targets[insId][0]} and ins_id=${insId} and product_id=${productId} for update`;
    const results = await tx`select * from inspiration_results where ins_id=${insId} and product_id=${productId}`;
    assert.equal(inspirations.length, 1);
    assert.equal(queues.length, 1);
    const inspiration = inspirations[0], queue = queues[0];
    record('before', {inspiration, queue, results});
    assert.equal(results.length, 0, 'Do not overwrite existing results');
    assert.equal(queue.url, inspiration.url);
    assert.equal(new URL(queue.url).searchParams.get('id'), targets[insId][1]);
    assert.equal(queue.status, 'failed');
    assert.equal(queue.claimed_by, null);
    assert.equal(queue.claimed_at, null);
    assert.equal(queue.worker_assignment, 'auto');
    assert.match(queue.error_message, targets[insId][2]);
    if (!process.argv.includes('--apply')) return;
    const workers = await tx`select capabilities from worker_registry where worker_id='gp-mac-mini' and enabled=true and last_heartbeat>now()-interval '2 minutes' and status in ('idle','busy')`;
    assert.equal(workers[0]?.capabilities?.facebook_evidence, 'exact-ad-v1', 'Wait for updated Mac mini');
    const changed = await tx`update inspiration_queue set status='pending', error_message=null, claimed_at=null, claimed_by=null, processed_at=null, worker_assignment='gp-mac-mini' where id=${queue.id} and product_id=${productId} and ins_id=${insId} and status='failed' and claimed_by is null returning *`;
    assert.equal(changed.length, 1);
    assert.deepEqual(changed[0], {...queue, status: 'pending', error_message: null, claimed_at: null, claimed_by: null, processed_at: null, worker_assignment: 'gp-mac-mini'});
    assert.deepEqual((await tx`select * from inspirations where id=${insId} and product_id=${productId}`)[0], inspiration);
    record('after', {queue: changed[0], inspirationUnchanged: true});
  });
  record('completed', {applied: process.argv.includes('--apply'), at: new Date().toISOString()});
  console.log(`${insId}: scoped recovery verified; applied=${process.argv.includes('--apply')}`);
} finally {await sql.end({timeout: 2});}
