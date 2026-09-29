import test from 'node:test';
import assert from 'node:assert/strict';
import { placeInspiration } from '../../lib/services/inspiration-placement.js';
import { QA_SUPABASE_URL } from '../../lib/qa-supabase-env.js';
const request={p_product_id:'qa',p_angle_id:'A',p_persona_id:'P',p_kind:'inspiration',p_items:[{sourceId:'INS'}],p_request_id:'same-request'};
function fixture() {
  const rows={ads:{id:'AD',product_id:'qa',meta:{_fromInspoId:'INS'}},matrix_cells:{product_id:'qa',angle_id:'A',persona_id:'P',creative_assignments:['AD']}};
  const client={supabaseUrl:QA_SUPABASE_URL,rpc:async(name,args)=>{assert.equal(name,'qa_matrix_create');assert.equal(args,request);return {data:['AD']};},from(table){const query={select(){return query;},eq(){return query;},async maybeSingle(){return {data:rows[table]};}};return query;}};
  return {rows,client};
}
test('placement confirms source, product and explicit Matrix assignment before success',async()=>{
  const {client}=fixture();assert.equal(await placeInspiration(client,request),'AD');
});
test('placement refuses production and retains uncertainty for malformed acknowledgements',async()=>{
  const {client}=fixture();client.supabaseUrl='https://production.supabase.co';client.rpc=()=>assert.fail();
  await assert.rejects(placeInspiration(client,request),/restricted to QA/);
  for(const data of [null,[],['AD','OTHER'],[null],['']]) {
    const {client}=fixture();client.rpc=async()=>({data});await assert.rejects(placeInspiration(client,request),/Retry the same placement/);
  }
});
test('placement rejects foreign/deleted/wrong-source ads and missing or excluded cell assignments',async()=>{
  for(const [table,patch] of [['ads',{product_id:'foreign'}],['ads',{deleted_at:'2026-09-23'}],['ads',{meta:{_fromInspoId:'other'}}],['matrix_cells',{angle_id:'other'}],['matrix_cells',{creative_assignments:[]}],['matrix_cells',{meta:{_excludedCreativeIds:['AD']}}]]) {
    const {client,rows}=fixture();Object.assign(rows[table],patch);await assert.rejects(placeInspiration(client,request),/could not be verified/);
  }
});
test('placement differentiates definite SQL rejection from a lost reply',async()=>{
  const {client}=fixture();client.rpc=async()=>({error:{message:'Source changed',code:'P0001'}});
  await assert.rejects(placeInspiration(client,request),error=>error.definite===true);
  client.rpc=async()=>({error:{message:'Failed to fetch'}});
  await assert.rejects(placeInspiration(client,request),error=>error.definite===false);
});
