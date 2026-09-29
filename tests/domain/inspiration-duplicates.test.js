import test from 'node:test';
import assert from 'node:assert/strict';
import { inspirationDuplicateState } from '../../lib/domain/inspiration-duplicates.js';
import { eligibleInspirationCreatives } from '../../lib/domain/inspiration-mapping.js';
import { inspirationRequest } from '../../lib/domain/inspiration-editing.js';
const row={id:'INS',productId:'qa',version:'v1',status:'Classified',angle:'Energy tools',persona:'Busy parents',funnelStage:'TOF',hookType:'Question',creativeStructure:'Testimonial',editFields:{_dupeDetail:'Obsolete',_dupeBannerDismissed:true}};
const ad=(id,patch={})=>({id,productId:'qa',formatName:id,status:'Testing',angle:row.angle,persona:row.persona,funnelStage:'TOF',hookType:'Question',creativeStructure:'Testimonial',...patch});
test('duplicates rank exact, combination and format matches with legacy word overlap and outcome priority',()=>{
  const ads=[ad('F',{persona:'Different',funnelStage:'BOF',status:'Winner'}),ad('C',{funnelStage:'MOF',status:'Loser'}),ad('E',{angle:'Energy benefits'}),ad('NO',{angle:'Different',persona:'Unrelated'})];
  const state=inspirationDuplicateState(row,ads);
  assert.deepEqual(state.duplicateMatches.map((match)=>[match.id,match.matchType]),[['E','exact'],['C','combo'],['F','format']]);
  assert.equal(state.duplicateType,'winner');assert.match(state.duplicate,/Exact match/);assert.equal(state.duplicateReviewed,false);
  assert.match(inspirationDuplicateState(row,ads.slice(0,2)).duplicate,/1 existing creative/);
  assert.match(inspirationDuplicateState(row,ads.slice(0,1)).duplicate,/Similar hook/);
  assert.equal(inspirationDuplicateState({...row,angle:'the',persona:'',hookType:''},[ad('SHORT',{angle:'the best'})]).duplicate,'');
});
test('duplicate projection clears stale evidence and excludes foreign, deleted, quarantined, hidden and tombstoned creatives',()=>{
  const raw=[{id:'A',product_id:'qa',angle:row.angle,persona:row.persona},
    {id:'FOREIGN',product_id:'other',angle:row.angle,persona:row.persona},
    {id:'DELETED',product_id:'qa',angle:row.angle,persona:row.persona,deleted_at:'x'},
    {id:'HIDDEN',product_id:'qa',angle:row.angle,persona:row.persona,meta:{trackerRefId:'A'}},
    {id:'QUARANTINED',product_id:'qa',angle:row.angle,persona:row.persona,meta:{_productBoundaryQuarantined:true}}];
  assert.equal(inspirationDuplicateState(row,eligibleInspirationCreatives('qa',raw,[{id:'A',product_id:'qa'}])).duplicate,'');
  assert.equal(inspirationDuplicateState(row,[ad('FOREIGN',{productId:'other'}),ad('D',{deletedAt:'x'})]).duplicate,'');
  for(const status of ['Queued','Classifying','Blocked','Failed'])assert.equal(inspirationDuplicateState({...row,status},[ad('A')]).duplicate,'');
  assert.equal(inspirationDuplicateState({...row,angle:'',persona:''},[ad('A')]).duplicate,'');
  assert.equal(row.editFields._dupeDetail,'Obsolete');
});
test('review signature covers all matches, remains stable on reorder and unrelated edits, and invalidates on relevant changes',()=>{
  const ads=Array.from({length:6},(_,i)=>ad(String(i)));
  const initial=inspirationDuplicateState(row,ads);assert.equal(initial.duplicateMatches.length,4);
  const reviewed={...row,editFields:{...row.editFields,_qaDupeReviewSignature:initial.duplicateSignature}};
  assert.equal(inspirationDuplicateState(reviewed,[...ads].reverse()).duplicateReviewed,true);
  assert.equal(inspirationDuplicateState({...reviewed,notes:'changed'},ads).duplicateReviewed,true);
  for(const changed of [[...ads,ad('NEW')],ads.slice(1),ads.map((a)=>a.id==='5'?{...a,status:'Winner'}:a),ads.map((a)=>a.id==='5'?{...a,formatName:'New name'}:a)])assert.equal(inspirationDuplicateState(reviewed,changed).duplicateReviewed,false);
  assert.equal(inspirationDuplicateState({...reviewed,funnelStage:'MOF'},ads).duplicateReviewed,false);
  const request=inspirationRequest('qa','dismiss_duplicate',{...row,...initial},{},{},'receipt');
  assert.equal(request.p_values.duplicateSignature,initial.duplicateSignature);
  assert.throws(()=>inspirationRequest('qa','dismiss_duplicate',row),/current duplicate match/);
});
