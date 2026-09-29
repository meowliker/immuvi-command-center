import { test } from 'node:test';
import assert from 'node:assert/strict';
import { privateInspirationRetry, queuedBefore, canQueueInspirationWorker } from '../../lib/domain/private-inspiration-queue.js';

test('single-item retry reuses saved output, ignores other sources, and protects active/delivered work',()=>{
  const failed={id:'job',inspiration_id:'one',worker_id:'mac',status:'failed',has_result:true,can_retry_delivery:true};
  assert.deepEqual(privateInspirationRetry([failed],'one'),{recoveryJobId:'job',workerId:'mac'});
  assert.deepEqual(privateInspirationRetry([failed],'two'),{});
  assert.deepEqual(privateInspirationRetry([{...failed,has_result:false}],'one'),{});
  for(const status of ['pending','running','done'])assert.throws(()=>privateInspirationRetry([{...failed,status}],'one'));
  assert.throws(()=>privateInspirationRetry([{...failed,can_retry_delivery:false}],'one'),/review/);
});
test('offline queueing is limited to enabled recovery-aware shared workers',()=>{
  const worker={enabled:true,scope:'shared',recovery_protocol:2,classifier_available:false,heartbeat_at:null};
  assert.equal(canQueueInspirationWorker(worker),true);
  for(const patch of [{scope:'private'},{recovery_protocol:1},{enabled:false}])assert.equal(canQueueInspirationWorker({...worker,...patch}),false);
  assert.equal(canQueueInspirationWorker({...worker,scope:'private',classifier_available:true,heartbeat_at:new Date().toISOString()}),true);
});
test('safe source retry reuses the same job and uncertain generation requires review',()=>{
  const job={id:'existing',worker_id:'mini',inspiration_id:'one',status:'failed',recovery_version:2,can_retry_processing:true};
  assert.deepEqual(privateInspirationRetry([job],'one'),{recoveryJobId:'existing',workerId:'mini'});
  assert.throws(()=>privateInspirationRetry([{...job,can_retry_processing:false,generation_started:true}],'one'),/already have run/);
});
test('queue priority overrides FIFO; FIFO and stable IDs break ties',()=>{
  const rows=[{id:'a',priority:3,queuedAt:1},{id:'b',priority:1,queuedAt:3},{id:'c',priority:2,queuedAt:2}];
  assert.deepEqual(rows.sort(queuedBefore).map(row=>row.id),['b','c','a']);
  assert.ok(queuedBefore({id:'a',queuedAt:1},{id:'b',queuedAt:2})<0);
  assert.ok(queuedBefore({id:'a',queuedAt:1},{id:'b',queuedAt:1})<0);
});
