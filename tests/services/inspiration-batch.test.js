import test from 'node:test';
import assert from 'node:assert/strict';
import { importInspirationBatch } from '../../lib/services/inspiration-batch.js';
import { QA_SUPABASE_URL } from '../../lib/qa-supabase-env.js';
const entries=()=>['A','B','C'].map((id)=>({id,status:'pending',request:{p_id:id,p_request_id:`receipt-${id}`,p_product_id:'qa',p_operation:'import',p_values:{children:[{id:`AD-${id}`}]}}}));
const saved=(r)=>({requestId:r.p_request_id,productId:r.p_product_id,id:r.p_id,operation:'import',dispatchEnabled:false,remoteAdIds:[],row:{id:r.p_id,product_id:r.p_product_id,updated_at:'v2'}});
test('batch pauses at lost acknowledgement, keeps exact requests and skips confirmed successes on retry',async()=>{
  const calls=[],initial=entries();let lose=true;
  const db={supabaseUrl:QA_SUPABASE_URL,async rpc(name,r){calls.push(structuredClone(r));if(r.p_id==='B'&&lose){lose=false;return{data:{...saved(r),requestId:'wrong'}};}return{data:saved(r)};}};
  const progress=[];const partial=await importInspirationBatch(db,initial,{progress:(rows)=>progress.push(rows)});
  assert.deepEqual(partial.map((e)=>e.status),['imported','uncertain','pending']);assert.deepEqual(initial.map((e)=>e.status),['pending','pending','pending']);
  const final=await importInspirationBatch(db,partial);assert.deepEqual(final.map((e)=>e.status),['imported','imported','imported']);
  assert.deepEqual(calls.map((r)=>r.p_id),['A','B','B','C']);assert.deepEqual(calls[1],calls[2]);assert.equal(progress.length,2);
});
test('definite conflicts are reported per source while other imports continue; remote failure never undoes an import',async()=>{
  const db={supabaseUrl:QA_SUPABASE_URL,async rpc(name,r){return r.p_id==='B'?{error:{code:'P0001',message:'Changed source'}}:{data:{...saved(r),remoteAdIds:[`AD-${r.p_id}`]}};}};
  const result=await importInspirationBatch(db,entries(),{pushCreative:async()=>{throw new Error('outage');}});
  assert.deepEqual(result.map((e)=>e.status),['imported','failed','imported']);assert.match(result[0].warning,/1 ClickUp/);assert.equal(result[1].error,'Changed source');
  db.rpc=()=>assert.fail('No completed or definite-failure item should replay.');await importInspirationBatch(db,result);
});
test('non-QA batch is stopped before writes',async()=>{
  const result=await importInspirationBatch({supabaseUrl:'https://production.supabase.co',rpc:()=>assert.fail()},entries());
  assert.deepEqual(result.map((e)=>e.status),['uncertain','pending','pending']);assert.match(result[0].error,/restricted to QA/);
});
