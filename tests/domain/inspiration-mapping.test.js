import test from 'node:test';
import assert from 'node:assert/strict';
import { activeInspirationTaxonomy,inspirationSuggestions,inspirationMappingRequest,eligibleInspirationCreatives,inspirationDuplicateLinks,mappingNeedsReview } from '../../lib/domain/inspiration-mapping.js';
const row={id:'INS',productId:'qa',version:'v1',angle:'Energy tools',persona:'Busy people',editFields:{_dupeSimilar:[]}};
const target={id:'A',product_id:'qa',name:'Energy tool',updated_at:'t1'};
test('mapping suggestions only rank active same-product entries',()=>{
  const rows=[target,{...target,id:'foreign',product_id:'other'},{...target,id:'archived',archived_at:'x'},{...target,id:'deleted',deleted_at:'x'}];
  assert.deepEqual(activeInspirationTaxonomy('qa',rows),[target]);
  assert.equal(inspirationSuggestions(row,'angle',rows)[0].id,'A');assert.ok(inspirationSuggestions(row,'angle',rows)[0].score>=.82);
  assert.equal(mappingNeedsReview(row,'angle',rows),true);
});
test('mapping requests retain version and only explicitly promote taxonomy',()=>{
  const request=inspirationMappingRequest(row,'angle','existing','',target,'receipt');
  assert.equal(request.p_expected_updated_at,'v1');assert.equal(request.p_values.mapping.targetVersion,'t1');assert.deepEqual(request.p_values.fields,{angle:'Energy tool'});
  assert.equal(inspirationMappingRequest(row,'persona','custom','  Local   label ').p_values.fields.persona,'Local label');
  assert.equal(inspirationMappingRequest(row,'persona','new','New persona').p_values.mapping.mode,'new');
  assert.throws(()=>inspirationMappingRequest(row,'angle','existing','',{...target,archived_at:'x'}),/active/);
  assert.throws(()=>inspirationMappingRequest(row,'angle','existing','',{...target,product_id:'other'}),/active/);
  assert.throws(()=>inspirationMappingRequest(row,'angle','new',''),/name/);
});
test('duplicate references resolve current data without exposing stale or foreign labels',()=>{
  const ads=[{id:'A',product_id:'qa',format_name:'Current title',status:'Winner',clickup_task_id:'TASK'},
    {id:'B',product_id:'other',format_name:'Foreign'},{id:'C',product_id:'qa',deleted_at:'x'},
    {id:'D',product_id:'qa',meta:{_productBoundaryQuarantined:true}},{id:'E',product_id:'qa',clickup_task_id:'REMOVED'}];
  const creatives=eligibleInspirationCreatives('qa',ads,[{product_id:'qa',clickup_task_id:'REMOVED'}]);assert.deepEqual(creatives.map((ad)=>ad.id),['A']);
  const links=inspirationDuplicateLinks({...row,editFields:{_dupeSimilar:[{id:'TASK',name:'Stale title',matchType:'exact'},'A','B','C','D','E','missing']}},creatives);
  assert.equal(links[0].title,'Current title');assert.equal(links[0].id,'A');assert.equal(links[0].matchType,'exact');assert.equal(links.filter((item)=>item.available).length,1);
  assert.ok(links.slice(1).every((item)=>item.title==='Creative unavailable'));
  assert.equal(inspirationDuplicateLinks({...row,editFields:{_dupeSimilar:['TASK']}},[...creatives,{...creatives[0],id:'OTHER'}])[0].available,false);
  const collision=[...creatives,{...creatives[0],id:'OTHER',clickupTaskId:'A'}];
  for(const refs of [['A','TASK'],['TASK','A']]) {
    const resolved=inspirationDuplicateLinks({...row,editFields:{_dupeSimilar:refs}},collision);
    assert.equal(resolved.length,1);assert.equal(resolved[0].id,'A');assert.equal(resolved[0].available,true);
  }
});
