import test from 'node:test';
import assert from 'node:assert/strict';
import { mutateInspiration } from '../../lib/services/inspiration-mutations.js';
import { inspirationMappingRequest } from '../../lib/domain/inspiration-mapping.js';
import { QA_SUPABASE_URL } from '../../lib/qa-supabase-env.js';
test('mapping save verifies receipt, target, field and review acknowledgement',async()=>{
  const request=inspirationMappingRequest({id:'INS',productId:'qa',version:'v1'},'angle','new','New angle',null,'receipt');
  const saved={requestId:'receipt',productId:'qa',operation:'save',id:'INS',dispatchEnabled:false,remoteAdIds:[],row:{id:'INS',product_id:'qa',updated_at:'v2',data:{angle:'New angle',_needsAngleReview:false}},mapping:{kind:'angle',mode:'new',name:'New angle',targetId:'NEW'}};
  const db={supabaseUrl:QA_SUPABASE_URL,rpc:async(name,args)=>{assert.equal(name,'qa_inspiration_mapping');assert.equal(args,request);return{data:saved};}};
  assert.deepEqual(await mutateInspiration(db,request),saved);
  for(const patch of [{name:'Other'},{targetId:null},{targetId:{}},{targetId:''},{kind:'persona'},{mode:'custom'}]) {
    db.rpc=async()=>({data:{...saved,mapping:{...saved.mapping,...patch}}});await assert.rejects(mutateInspiration(db,request),/could not be verified/);
  }
});
