import test from 'node:test';
import assert from 'node:assert/strict';
import {inspirationRecoveryIssue,inspirationRecoveryRequest} from '../../lib/domain/inspiration-recovery.js';
const row={id:'QRC-INS-001',productId:'qa',queueOnly:true,queueSnapshot:{id:'queue-id',product_id:'qa',ins_id:'QRC-INS-001',url:'https://example.test/source',status:'failed',attempts:3}};
test('recovery accepts only same-product queue-only terminal snapshots and does not mutate them',()=>{
  const request=inspirationRecoveryRequest('qa',row,'req');
  assert.deepEqual(request,{p_product_id:'qa',p_request_id:'req',p_queue_id:'queue-id',p_expected_queue:row.queueSnapshot});
  assert.notEqual(request.p_expected_queue,row.queueSnapshot);request.p_expected_queue.attempts=8;assert.equal(row.queueSnapshot.attempts,3);
  for(const status of ['failed','error','blocked','classified','done','completed'])assert.equal(inspirationRecoveryIssue({...row,queueSnapshot:{...row.queueSnapshot,status}},'qa'),'');
});
test('active, unknown, foreign, saved, unsafe URL and missing queue identities fail closed',()=>{
  for(const status of ['pending','processing','claimed','classifying','unknown',''])assert.match(inspirationRecoveryIssue({...row,queueSnapshot:{...row.queueSnapshot,status}},'qa'),/Only terminal/);
  for(const changed of [{...row,queueOnly:false},{...row,productId:'foreign'},{...row,queueSnapshot:null},{...row,queueSnapshot:{...row.queueSnapshot,ins_id:'OTHER'}},{...row,queueSnapshot:{...row.queueSnapshot,product_id:'foreign'}}])assert.throws(()=>inspirationRecoveryRequest('qa',changed),/active product/);
  for(const url of ['javascript:alert(1)','https://user:secret@example.test',''])assert.match(inspirationRecoveryIssue({...row,queueSnapshot:{...row.queueSnapshot,url}},'qa'),/URL/);
});
