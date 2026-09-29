import test from 'node:test';
import assert from 'node:assert/strict';
import { findInspirationBrief,saveInspirationBrief } from '../../lib/services/inspiration-brief.js';
import { createClickUpClient } from '../../lib/services/clickup-client.js';
import { QA_SUPABASE_URL } from '../../lib/qa-supabase-env.js';
const listId='1301130000002447',url='https://app.clickup.com/123/v/dc/doc/page';
function setup(){
  const row={id:'INS',product_id:'qa',updated_at:'v1',data:{_sourceClickupId:'TASK'}},calls=[];
  const db={supabaseUrl:QA_SUPABASE_URL,from(table){return{select(){return this;},eq(){return this;},async maybeSingle(){calls.push(table);return {data:table==='inspirations'?structuredClone(row):null};}};}};
  const clickup={async getTask(list,id){assert.equal(list,listId);assert.equal(id,'TASK');calls.push('task');return{description:url};},async comments(){calls.push('comments');return[{comment_text:url}];}};
  return{row,calls,db,clickup,product:{id:'qa'},profile:{id:'user',role:'member'},listId,input:{inspirationId:'INS',expectedUpdatedAt:'v1'}};
}
test('lookup checks saved source/version and finds description or comment links without remote writes',async()=>{
  const f=setup();assert.equal((await findInspirationBrief(f)).url,url);assert.deepEqual(f.calls,['inspirations','task']);
  f.clickup.getTask=async()=>({description:'No document here'});assert.equal((await findInspirationBrief(f)).url,url);
  f.clickup.comments=async()=>[];await assert.rejects(findInspirationBrief(f),/No brief link/);
});
test('lookup denies production, stale sources, inaccessible imports and task membership failure',async()=>{
  const f=setup();f.db.supabaseUrl='production';await assert.rejects(findInspirationBrief(f),/QA/);assert.deepEqual(f.calls,[]);
  const stale=setup();stale.row.updated_at='v2';await assert.rejects(findInspirationBrief(stale),/changed/);assert.deepEqual(stale.calls,['inspirations']);
  const other=setup();other.row.data._sourceProductId='foreign';await assert.rejects(findInspirationBrief(other),/access/);assert.deepEqual(other.calls,['inspirations','user_products']);
  const moved=setup();moved.clickup.getTask=async()=>{throw new Error('Outside QA list');};await assert.rejects(findInspirationBrief(moved),/Outside/);assert.equal(moved.calls.includes('comments'),false);
});
test('brief saves require exact acknowledgements and separate definite conflicts from lost replies',async()=>{
  const request={p_request_id:'receipt',p_product_id:'qa',p_id:'INS',p_url:url};
  const saved={requestId:'receipt',productId:'qa',row:{id:'INS',product_id:'qa',updated_at:'v2',data:{_clickupDocPageUrl:url}},dispatchEnabled:false};
  const db={supabaseUrl:QA_SUPABASE_URL,rpc:async(name,input)=>{assert.equal(name,'qa_inspiration_brief');assert.equal(input,request);return {data:saved};}};
  assert.deepEqual(await saveInspirationBrief(db,request),saved);
  db.rpc=async()=>({data:{...saved,requestId:'other'}});await assert.rejects(saveInspirationBrief(db,request),/same request/);
  db.rpc=async()=>({error:{code:'P0001',message:'changed'}});await assert.rejects(saveInspirationBrief(db,request),(error)=>error.definite);
});
test('accessible imported sources reuse stored briefs or read their saved task identity',async()=>{
  const f=setup();f.row.data={_sourceProductId:'source',_sourceInsId:'ORIGINAL'};
  const original={id:'ORIGINAL',product_id:'source',data:{_clickupDocPageUrl:url,_sourceClickupId:'TASK'}};
  let sourceList=listId;
  f.db.from=(table)=>{const filters={};return{select(){return this;},eq(key,value){filters[key]=value;return this;},async maybeSingle(){
    f.calls.push([table,{...filters}]);
    return{data:table==='user_products'?{product_id:'source'}:table==='products'?{id:'source',config:{clickup_list_id:sourceList}}:filters.product_id==='qa'?f.row:original};
  }};};
  assert.equal((await findInspirationBrief(f)).url,url);
  assert.deepEqual(f.calls[1],['user_products',{user_id:'user',product_id:'source'}]);
  assert.deepEqual(f.calls[3],['inspirations',{product_id:'source',id:'ORIGINAL'}]);
  assert.equal(f.calls.includes('task'),false);
  delete original.data._clickupDocPageUrl;assert.equal((await findInspirationBrief(f)).url,url);assert.equal(f.calls.includes('task'),true);
  sourceList='production';await assert.rejects(findInspirationBrief(f),/QA list/);
  sourceList=listId;original.deleted_at='2026-09-23';await assert.rejects(findInspirationBrief(f),/unavailable/);
});
test('comment history uses both cursors, rejects nonadvancing pages and verifies QA membership first',async()=>{
  const paths=[];let repeat=false;
  const full=Array.from({length:25},(_,i)=>({id:String(i),date:'123456'}));
  const client=createClickUpClient('synthetic',{fetchImpl:async(input)=>{const u=new URL(input);paths.push(u.pathname+u.search);return Response.json(u.pathname.endsWith('/comment')?{comments:!u.search || repeat?full:[{id:'last',date:'123000',comment_text:url}]}:{id:'TASK',list:{id:listId}});}});
  assert.equal((await client.comments(listId,'TASK')).length,26);assert.ok(paths.at(-1).includes('start=123456&start_id=24'));
  repeat=true;await assert.rejects(client.comments(listId,'TASK'),/did not advance/);
  const count=paths.length;await assert.rejects(client.comments('production','TASK'),/QA/);assert.equal(paths.length,count);
});
