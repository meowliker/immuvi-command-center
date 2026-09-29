import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverInspiration} from '../../lib/services/inspiration-recovery.js';
import {QA_SUPABASE_URL} from '../../lib/qa-supabase-env.js';
const old={id:'q',ins_id:'i',product_id:'qa',url:'https://example.test/ad',queued_at:'2026-09-01',processed_at:null,attempts:3};
const request={p_product_id:'qa',p_request_id:'r',p_queue_id:'q',p_expected_queue:old};
const saved={requestId:'r',productId:'qa',operation:'recover',id:'i',dispatchEnabled:false,row:{id:'i',product_id:'qa',updated_at:'2026-09-23',status:'Blocked',url:old.url},queue:{...old,status:'blocked',worker_assignment:'blocked:qa-isolation',claimed_by:null,claimed_at:null}};
const db=(data,error)=>({supabaseUrl:QA_SUPABASE_URL,rpc:async(name,input)=>{assert.equal(name,'qa_inspiration_recover');assert.equal(input,request);return {data,error};}});
test('recovery acknowledgement requires source identity, isolated queue and preserved chronology',async()=>{
  assert.equal(await recoverInspiration(db(saved),request),saved);
  for(const changed of [null,{...saved,dispatchEnabled:true},{...saved,productId:'foreign'},{...saved,row:{...saved.row,id:'wrong'}},{...saved,queue:{...saved.queue,attempts:0}},{...saved,queue:{...saved.queue,queued_at:'new'}},{...saved,queue:{...saved.queue,worker_assignment:'auto'}},{...saved,queue:{...saved.queue,claimed_by:'worker'}},{...saved,queue:{...saved.queue,id:'other'}}])await assert.rejects(recoverInspiration(db(changed),request),/could not be verified/);
});
test('non-QA recovery is denied before RPC; definite conflicts and uncertain failures differ',async()=>{
  await assert.rejects(recoverInspiration({supabaseUrl:'https://production.invalid',rpc:()=>assert.fail()},request),(error)=>error.definite===true);
  await assert.rejects(recoverInspiration(db(null,{code:'P0001',message:'Queue changed'}),request),(error)=>error.definite===true);
  await assert.rejects(recoverInspiration(db(null,{code:'NETWORK',message:'Disconnected'}),request),(error)=>error.definite===false);
});
