import test from 'node:test';
import assert from 'node:assert/strict';
import { mutateInspiration } from '../../lib/services/inspiration-mutations.js';
import { QA_SUPABASE_URL } from '../../lib/qa-supabase-env.js';
const request = { p_product_id:'qa',p_request_id:'request',p_operation:'save',p_id:'INS-1',p_values:{children:[{id:'AD-1'}]} };
const saved = { requestId:'request',productId:'qa',operation:'save',id:'INS-1',dispatchEnabled:false,remoteAdIds:['AD-1'],row:{id:'INS-1',product_id:'qa',updated_at:'2026-09-22'} };
const db = (data = saved, error = null) => ({supabaseUrl:QA_SUPABASE_URL,rpc:async(name,input)=>{assert.equal(name,'qa_inspiration_mutate');assert.equal(input,request);return {data,error};}});
test('inspiration writes refuse non-QA clients before network access', async () => {
  await assert.rejects(mutateInspiration({supabaseUrl:'https://production.supabase.co',rpc:()=>assert.fail()},request),/restricted to QA/);
});
test('inspiration receipt validates product, request, row and linked creative identity', async () => {
  assert.deepEqual(await mutateInspiration(db(),request),saved);
  for (const patch of [{requestId:'other'},{productId:'other'},{operation:'delete'},{id:'other'},{dispatchEnabled:true},{remoteAdIds:['FOREIGN']},{row:{...saved.row,product_id:'other'}},{row:{...saved.row,updated_at:null}}])
    await assert.rejects(mutateInspiration(db({...saved,...patch}),request),/Retry this same request/);
});
test('inspiration database conflicts are definite while transport failures retain retry identity', async () => {
  await assert.rejects(mutateInspiration(db(null,{code:'P0001',message:'Stale draft'}),request),(error)=>error.definite && error.message==='Stale draft');
  await assert.rejects(mutateInspiration(db(null,{message:'Failed to fetch'}),request),(error)=>error.definite===false);
  await assert.rejects(mutateInspiration(db(null),request),/could not be verified/);
});
test('inspiration delete requires explicit deletion and no returned row', async () => {
  const deletion = {...request,p_operation:'delete'};
  const client = {supabaseUrl:QA_SUPABASE_URL,rpc:async()=>({data:{...saved,operation:'delete',deleted:true,row:null}})};
  assert.equal((await mutateInspiration(client,deletion)).deleted,true);
  client.rpc=async()=>({data:{...saved,operation:'delete',deleted:false,row:null}});
  await assert.rejects(mutateInspiration(client,deletion),/could not be verified/);
});
test('format detail saves use the extending RPC and the same strict acknowledgement checks',async()=>{
  const detail={...request,p_values:{...request.p_values,fields:{formatDetail:'New detail'}}};
  const detailSaved={...saved,row:{...saved.row,data:{formatName:'Name',creativeUSP:'Name \u2014 New detail'}}};
  const client={supabaseUrl:QA_SUPABASE_URL,rpc:async(name,input)=>{assert.equal(name,'qa_inspiration_detail');assert.equal(input,detail);return{data:detailSaved};}};
  assert.deepEqual(await mutateInspiration(client,detail),detailSaved);
  client.rpc=async()=>({data:saved});await assert.rejects(mutateInspiration(client,detail),/Detail save could not be verified/);
  client.rpc=async()=>({data:{...saved,requestId:'other'}});await assert.rejects(mutateInspiration(client,detail),/could not be verified/);
});
test('ordinary saves verify every requested value before accepting a receipt',async()=>{
  const fields={formatName:'Renamed',notes:'',angle:'Energy',adType:'Photo',platform:'Instagram',addedBy:'QA'};
  const input={...request,p_values:{...request.p_values,fields}};
  const response={...saved,row:{...saved.row,data:{...fields}}};
  const client={supabaseUrl:QA_SUPABASE_URL,rpc:async()=>({data:response})};
  assert.deepEqual(await mutateInspiration(client,input),response);
  for(const key of Object.keys(fields)) {
    client.rpc=async()=>({data:{...response,row:{...response.row,data:{...fields,[key]:'Wrong acknowledgement'}}}});
    await assert.rejects(mutateInspiration(client,input),/Saved fields could not be verified/);
  }
});
test('intake verifies source identity as well as submitted manual fields',async()=>{
  const input={...request,p_operation:'create',p_id:null,p_values:{children:[],fields:{sourceUrl:'https://example.test/source',formatName:'Manual'}}};
  const response={...saved,operation:'create',remoteAdIds:[],row:{...saved.row,url:'https://example.test/source',data:{formatName:'Manual'}}};
  const client={supabaseUrl:QA_SUPABASE_URL,rpc:async()=>({data:response})};
  assert.deepEqual(await mutateInspiration(client,input),response);
  client.rpc=async()=>({data:{...response,row:{...response.row,url:'https://example.test/other'}}});
  await assert.rejects(mutateInspiration(client,input),/Saved fields could not be verified/);
});
