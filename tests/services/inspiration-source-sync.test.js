import test from 'node:test';
import assert from 'node:assert/strict';
import { syncInspirationSourceType } from '../../lib/services/inspiration-source-sync.js';
import { runClickUpIntegration } from '../../lib/services/clickup-integration.js';
import { QA_SUPABASE_URL } from '../../lib/qa-supabase-env.js';
import { QA_CLICKUP_LIST_ID as listId } from '../../lib/domain/clickup-sync.js';
function fixture(){
  const row={id:'INS',product_id:'qa',updated_at:'v1',data:{_sourceClickupId:'SOURCE',adType:'Photo'}},calls=[];
  const field={id:'type',name:'Photo/Video',type:'drop_down',type_config:{options:[{id:'photo',name:'Photo',orderindex:0},{id:'video',name:'Video',orderindex:1}]}};
  let remote='video',reads=0;
  const db={supabaseUrl:QA_SUPABASE_URL,from(table){assert.equal(table,'inspirations');return{select(){return this;},eq(k,v){assert.equal(v,k==='id'?'INS':'qa');return this;},async maybeSingle(){reads++;return{data:structuredClone(row)};}};}};
  const clickup={async inspect(id){assert.equal(id,listId);calls.push('schema');return{fields:[field]};},async getTask(id,task){assert.equal(id,listId);assert.equal(task,'SOURCE');calls.push('task');return{custom_fields:[{...field,value:remote}]};},async setField(id,task,f,value){assert.equal(id,listId);assert.equal(task,'SOURCE');assert.equal(f,field);calls.push(['write',value]);remote=value;}};
  return{db,clickup,product:{id:'qa',config:{clickup_list_id:listId}},profile:{role:'member'},listId,input:{operation:'sync-inspiration-type',inspirationId:'INS',expectedUpdatedAt:'v1',taskId:'IGNORED',adType:'IGNORED'},row,field,calls,reads:()=>reads};
}
test('source sync uses saved identity and field, verifies readback, routes through member integration',async()=>{
  const f=fixture();const result=await runClickUpIntegration(f);
  assert.deepEqual(result,{productId:'qa',inspirationId:'INS',version:'v1',taskId:'SOURCE',adType:'Photo',synced:true});assert.deepEqual(f.calls,['schema','task',['write','photo'],'task']);assert.equal(f.reads(),3);
  f.row.data.adType='';assert.equal((await syncInspirationSourceType(f)).adType,'');assert.deepEqual(f.calls.filter(Array.isArray).at(-1),['write',null]);
});
test('source sync denies non-QA, foreign, missing, stale and cross-product sources before writes',async()=>{
  for(const change of [(f)=>f.db.supabaseUrl='https://production.supabase.co',(f)=>f.listId='production',(f)=>f.product.config.clickup_list_id='production',
    (f)=>f.row.product_id='foreign',(f)=>f.row.deleted_at='deleted',(f)=>f.row.updated_at='v2',(f)=>f.row.data._sourceProductId='foreign',(f)=>delete f.row.data._sourceClickupId,(f)=>delete f.row.data.adType]){
    const f=fixture();change(f);await assert.rejects(syncInspirationSourceType(f));assert.deepEqual(f.calls,[]);
  }
});
test('invalid mapping, unsupported field, ambiguous or missing dropdown option fail without writes',async()=>{
  for(const change of [(f)=>f.product.config.clickup_sync={list_id:listId,mappings:{ad_type:'missing'}},(f)=>f.field.type='users',
    (f)=>f.field.type_config.options=[],(f)=>f.field.type_config.options.push({id:'duplicate',name:'photo'})]){
    const f=fixture();change(f);await assert.rejects(syncInspirationSourceType(f));assert.equal(f.calls.some(Array.isArray),false);
  }
});
test('source link is rechecked after schema fetch; task membership failure cannot write',async()=>{
  const f=fixture();const inspect=f.clickup.inspect;f.clickup.inspect=async(id)=>{f.row.updated_at='new';return inspect(id);};
  await assert.rejects(syncInspirationSourceType(f),/changed/);assert.equal(f.calls.some(Array.isArray),false);
  const other=fixture();other.clickup.getTask=async()=>{throw new Error('Task outside QA list');};await assert.rejects(syncInspirationSourceType(other),/outside/);assert.equal(other.calls.some(Array.isArray),false);
});
test('unverified remote acknowledgement or a concurrent local edit never report success',async()=>{
  const f=fixture();f.clickup.setField=async()=>{};await assert.rejects(syncInspirationSourceType(f),/could not be verified/);
  const changed=fixture();const write=changed.clickup.setField;changed.clickup.setField=async(...args)=>{await write(...args);changed.row.updated_at='new';};await assert.rejects(syncInspirationSourceType(changed),/changed/);
});
