import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateJobPool } from '../../lib/services/private-job-pool.js';

test('two jobs overlap, third waits for capacity, duplicate claims cannot run',async()=>{
  const pool=createPrivateJobPool();
  let first,second;const started=[];
  const a=pool.start('a',()=>{started.push('a');return new Promise(resolve=>{first=resolve;});});
  const b=pool.start('b',()=>{started.push('b');return new Promise(resolve=>{second=resolve;});});
  await Promise.resolve();
  assert.deepEqual(started,['a','b']);assert.equal(pool.size,2);
  assert.throws(()=>pool.start('c',()=>{}),/capacity/);
  assert.throws(()=>pool.start('a',()=>{}),/capacity/);
  first();await a;
  await pool.start('c',()=>started.push('c'));
  second();await b;await pool.drain();assert.equal(pool.size,0);
});
test('failed jobs release capacity and draining waits for all active work',async()=>{
  const pool=createPrivateJobPool();
  await assert.rejects(pool.start('a',()=>{throw new Error('failed');}),/failed/);
  assert.equal(pool.size,0);
  let finish;pool.start('b',()=>new Promise(resolve=>{finish=resolve;}));
  await Promise.resolve();let drained=false;const drain=pool.drain().then(()=>{drained=true;});
  await Promise.resolve();assert.equal(drained,false);finish();await drain;assert.equal(drained,true);
});
