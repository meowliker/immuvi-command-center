import test from 'node:test';
import assert from 'node:assert/strict';
import { inspirationPlacementIndex, suggestedInspirationCell, inspirationCellSummary, inspirationPlacementReason, inspirationPlacementRequest } from '../../lib/domain/inspiration-placement.js';
const row={id:'INS-1',productId:'qa',version:'2026-09-23',status:'Classified',angle:'Energy',persona:'Busy people'};
const angle={id:'A',product_id:'qa',name:'Energy'},persona={id:'P',product_id:'qa',name:'Busy people'};
const index=(angles=[angle],personas=[persona],ads=[],cells=[],deleted=[])=>inspirationPlacementIndex('qa',angles,personas,ads,cells,deleted);
test('inspiration suggestions require unique active canonical axes in the same product',()=>{
  assert.deepEqual(suggestedInspirationCell({...row,angle:'  1. ENERGY '},index()),{angleId:'A',personaId:'P'});
  assert.equal(suggestedInspirationCell(row,index([angle,{...angle,id:'A2'}])),null);
  assert.equal(suggestedInspirationCell(row,index([{...angle,archived_at:'2026-09-23'}])),null);
  assert.equal(suggestedInspirationCell(row,index([{...angle,product_id:'other'}])),null);
  assert.equal(suggestedInspirationCell({...row,angle:'Unmatched'},index()),null);
});
test('placement usage excludes tombstones, foreign rows, quarantined and explicitly removed creatives',()=>{
  const ad={id:'AD',product_id:'qa',angle:'Energy',persona:'Busy people',status:'Winner',meta:{_sourceInsId:'INS-1'}};
  const cell={id:'C',product_id:'qa',angle_id:'A',persona_id:'P',creative_assignments:['AD']};
  assert.deepEqual(inspirationCellSummary(row,index([angle],[persona],[ad],[cell]),{angleId:'A',personaId:'P'}),{total:1,winners:1,testing:0,placed:true});
  for(const [ads,cells,deleted] of [[[ad],[cell],[{id:'AD',product_id:'qa'}]],[[{...ad,product_id:'other'}],[cell],[]],[[{...ad,meta:{...ad.meta,_productBoundaryQuarantined:true}}],[cell],[]],[[ad],[{...cell,meta:{_excludedCreativeIds:['AD']}}],[]]])
    assert.equal(inspirationCellSummary(row,index([angle],[persona],ads,cells,deleted),{angleId:'A',personaId:'P'}).placed,false);
});
test('placement requests capture source versions and destination IDs without remote side effects',()=>{
  const request=inspirationPlacementRequest('qa',row,index(),{angleId:'A',personaId:'P'},'request');
  assert.deepEqual(request,{p_product_id:'qa',p_angle_id:'A',p_persona_id:'P',p_kind:'inspiration',p_items:[{sourceId:'INS-1',version:'2026-09-23'}],p_request_id:'request'});
  for(const invalid of [{...row,productId:'other'},{...row,queueOnly:true},{...row,version:''},{...row,status:'Blocked'},{...row,status:'Queued'},{...row,status:'Unexpected'}]) assert.throws(()=>inspirationPlacementRequest('qa',invalid,index(),{angleId:'A',personaId:'P'}));
  assert.throws(()=>inspirationPlacementRequest('qa',row,index(),{angleId:'FOREIGN',personaId:'P'}),/active angle/);
  assert.equal(inspirationPlacementReason({...row,status:'Testing'}),'');
});
