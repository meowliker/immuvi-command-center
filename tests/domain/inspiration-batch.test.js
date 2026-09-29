import test from 'node:test';
import assert from 'node:assert/strict';
import { inspirationBatchCandidates, inspirationBatchRequests, inspirationResultIssue } from '../../lib/domain/inspiration-batch.js';
export function fixture(id='INS-1') {
  const row={id,productId:'qa',version:'v1',formatName:id,sourceUrl:`https://example.test/${id}`,queueOnly:false,queueSnapshot:null,editFields:{},usage:[]};
  const filled=(keys)=>Object.fromEntries(keys.split(' ').map((key)=>[key,'complete']));
  const result={id:`result-${id}`,product_id:'qa',ins_id:id,source_url:row.sourceUrl,classified_at:'2026-09-23T01:00:00Z',
    classification:filled('hook_type creative_structure production_style funnel_type persona angle creative_usp creative_hypothesis'),
    brief:{...filled('why_it_works replication_brief what_to_test competitor_intel our_next_ad inspiration_script_skeleton'),frame_by_frame:[{}],
      next_ad_scripts:Array.from({length:3},()=>({...filled('variation intent hook_text source_format_match voice_over_script cta what_to_change why_it_should_work'),script_breakdown:[{}]}))}};
  return {row,result};
}
test('batch preview chooses latest scoped result without falling back to an older complete result',()=>{
  const {row,result}=fixture();
  const newer={...result,id:'newer',classified_at:'2026-09-24',brief:{}};
  const candidates=inspirationBatchCandidates('qa',[row],[result,newer,{...result,product_id:'foreign'}]);
  assert.equal(candidates.length,1);assert.equal(candidates[0].result.id,'newer');assert.match(candidates[0].issue,/brief is incomplete/);
  assert.throws(()=>inspirationBatchRequests('qa',candidates,[row.id]),/eligible/);
});
test('batch preview rejects missing, active, stale, imported and incomplete records',()=>{
  const {row,result}=fixture();assert.equal(inspirationResultIssue(row,result,'qa'),'');
  for(const source of [null,{...row,queueOnly:true},{...row,version:''},{...row,productId:'foreign'},
    {...row,sourceUrl:'https://other.test/'},{...row,queueSnapshot:{status:'claimed'}},
    {...row,queueSnapshot:{queued_at:'2026-09-24'}},{...row,editFields:{_qaImportedResultAt:result.classified_at}}])assert.ok(inspirationResultIssue(source,result,'qa'));
  for(const patch of [{id:''},{classified_at:'invalid'},{product_id:'foreign'},{classification:{}},{brief:{...result.brief,next_ad_scripts:[null,null,null]}}])assert.ok(inspirationResultIssue(row,{...result,...patch},'qa'));
});
test('batch requests capture independent immutable source, queue, children and result snapshots',()=>{
  const {row,result}=fixture();row.usage=[{id:'AD',version:'ad-v'}];row.queueSnapshot={id:'Q',status:'blocked'};
  const candidates=inspirationBatchCandidates('qa',[row],[result]);
  const [entry]=inspirationBatchRequests('qa',candidates,[row.id],()=> 'receipt');
  row.queueSnapshot.status='processing';row.usage[0].version='changed';result.classified_at='later';
  assert.equal(entry.request.p_request_id,'receipt');assert.equal(entry.request.p_values.queue.status,'blocked');assert.equal(entry.request.p_values.children[0].version,'ad-v');assert.equal(entry.request.p_values.result_at,'2026-09-23T01:00:00Z');
  for(const selection of [[],[row.id,row.id],Array.from({length:51},(_,i)=>String(i)),['unknown']])assert.throws(()=>inspirationBatchRequests('qa',candidates,selection));
});
