import { test } from 'node:test';
import assert from 'node:assert/strict';
import { privateInspirationRetry, queuedBefore } from '../../lib/domain/private-inspiration-queue.js';

test('single-item retry reuses saved output, ignores other sources, and protects active/delivered work',()=>{
  const failed={id:'job',inspiration_id:'one',worker_id:'mac',status:'failed',has_result:true,can_retry_delivery:true};
  assert.deepEqual(privateInspirationRetry([failed],'one'),{recoveryJobId:'job',workerId:'mac'});
  assert.deepEqual(privateInspirationRetry([failed],'two'),{});
  assert.deepEqual(privateInspirationRetry([{...failed,has_result:false}],'one'),{});
  for(const status of ['pending','running','done'])assert.throws(()=>privateInspirationRetry([{...failed,status}],'one'));
  assert.throws(()=>privateInspirationRetry([{...failed,can_retry_delivery:false}],'one'),/review/);
});
test('queue priority overrides FIFO; FIFO and stable IDs break ties',()=>{
  const rows=[{id:'a',priority:3,queuedAt:1},{id:'b',priority:1,queuedAt:3},{id:'c',priority:2,queuedAt:2}];
  assert.deepEqual(rows.sort(queuedBefore).map(row=>row.id),['b','c','a']);
  assert.ok(queuedBefore({id:'a',queuedAt:1},{id:'b',queuedAt:2})<0);
  assert.ok(queuedBefore({id:'a',queuedAt:1},{id:'b',queuedAt:1})<0);
});
