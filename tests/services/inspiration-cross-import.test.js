import test from 'node:test';
import assert from 'node:assert/strict';
import { crossImportInspirations } from '../../lib/services/inspiration-cross-import.js';
import { QA_SUPABASE_URL } from '../../lib/qa-supabase-env.js';
const source={kind:'inspiration',sourceProductId:'source',sourceId:'INS',version:'2026-09-23'};
const request={p_product_id:'target',p_request_id:'request',p_items:[source]};
const saved={requestId:'request',productId:'target',operation:'cross_import',dispatchEnabled:false,items:[{...source,id:'DST-INS-001',status:'imported'}],imported:1,existing:0};
const db=(data=saved,error=null)=>({supabaseUrl:QA_SUPABASE_URL,rpc:async(name,args)=>{assert.equal(name,'qa_inspiration_cross_import');assert.equal(args,request);return {data,error};}});
test('cross-import acknowledgement verifies batch identity and counts',async()=>{
  assert.deepEqual(await crossImportInspirations(db(),request),saved);
  for(const patch of [{requestId:'other'},{productId:'other'},{dispatchEnabled:true},{operation:'other'},{imported:2},{existing:1},{items:[]},{items:[{...saved.items[0],sourceProductId:'foreign'}]},{items:[{...saved.items[0],status:'queued'}]}])
    await assert.rejects(crossImportInspirations(db({...saved,...patch}),request),/Retry the same import/);
});
test('cross-import refuses non-QA clients and distinguishes definitive rejection from uncertainty',async()=>{
  await assert.rejects(crossImportInspirations({supabaseUrl:'https://production.supabase.co',rpc:()=>assert.fail()},request),/restricted to QA/);
  await assert.rejects(crossImportInspirations(db(null,{code:'P0001',message:'Source changed'}),request),error=>error.definite===true);
  await assert.rejects(crossImportInspirations(db(null,{message:'Failed to fetch'}),request),error=>error.definite===false);
});
