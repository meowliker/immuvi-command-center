import test from 'node:test';
import assert from 'node:assert/strict';
import { crossProductSources,crossImportRequest,importSourceKey } from '../../lib/domain/inspiration-cross-import.js';
const product={id:'source',name:'Source'},stamp='2026-09-23T00:00:00Z';
const inspiration={id:'INS',product_id:'source',title:'Idea',url:'https://example.test/idea',status:'Classified',updated_at:stamp,data:{angle:'Energy',_clickupDocPageUrl:'https://example.test/brief'}};
const winner={id:'AD',product_id:'source',format_name:'Winner',ad_link:'https://example.test/winner',status:'Winner',updated_at:stamp,meta:{}};
test('cross-product sources are scoped and exclude deleted, quarantined, tombstoned and child winners',()=>{
  const rows=crossProductSources(product,[inspiration,{...inspiration,product_id:'foreign',id:'foreign'}],[],[
    winner,{...winner,id:'child',parent_ad_id:'parent'},{...winner,id:'deleted',deleted_at:stamp},{...winner,id:'quarantine',meta:{_productBoundaryQuarantined:true}},
    {...winner,id:'tombstone'},{...winner,id:'foreign',product_id:'other'},
  ],[{product_id:'source',id:'tombstone'}],[]);
  assert.deepEqual(rows.map((row)=>row.sourceId),['INS','AD']);assert.equal(rows[0].briefUrl,'https://example.test/brief');
});
test('cross-product blocked sources remain visible but cannot be imported',()=>{
  const [row]=crossProductSources(product,[inspiration],[{product_id:'source',ins_id:'INS',status:'blocked'}],[],[],[]);
  assert.equal(row.disabled,true);assert.throws(()=>crossImportRequest('target',[row]),/available sources/);
});
test('cross-product duplicate identity and normalized URLs are marked already imported',()=>{
  const rows=crossProductSources(product,[inspiration],[],[winner],[],[{sourceUrl:'https://example.test/idea/'},{editFields:{_sourceProductId:'source',_sourceAdId:'AD'}}]);
  assert.ok(rows.every((row)=>row.existing));
});
test('cross-product requests freeze only identity/version fields and reject invalid selections',()=>{
  const rows=crossProductSources(product,[inspiration],[],[winner],[],[]);
  const request=crossImportRequest('target',rows,'request');
  assert.equal(request.p_request_id,'request');assert.deepEqual(Object.keys(request.p_items[0]),['kind','sourceProductId','sourceId','version']);
  assert.equal(importSourceKey(request.p_items[0]),importSourceKey(rows[0]));
  for(const selected of [[],[rows[0],rows[0]],Array.from({length:51},(_,n)=>({...rows[0],sourceId:String(n)})),[{...rows[0],version:''}],[{...rows[0],kind:'unknown'}]])assert.throws(()=>crossImportRequest('target',selected));
  assert.throws(()=>crossImportRequest('source',rows),/other products/);
});
