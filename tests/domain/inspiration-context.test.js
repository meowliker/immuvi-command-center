import test from 'node:test';
import assert from 'node:assert/strict';
import { inspirationContext, findClickUpBrief, clickUpDocumentUrl } from '../../lib/domain/inspiration-context.js';
import { inspirationVoice, projectInspirationLibrary } from '../../lib/domain/inspiration-library.js';
test('reuse counts distinct accessible destination products, never stale hints or deleted copies',()=>{
  const products=[{id:'qa',name:'QA'},{id:'other',name:'Other'}];
  const copy={id:'copy',product_id:'other',data:{_sourceProductId:'qa',_sourceInsId:'INS'}};
  const rows=[{id:'INS',editFields:{_crossProductImports:['unknown']}},{id:'import',editFields:{_sourceProductId:'other',_sourceInsId:'SOURCE'}}];
  const snapshots=[copy,{...copy,id:'duplicate'},{...copy,id:'foreign',product_id:'secret'},
    {...copy,id:'gone',deleted_at:'now'}, {id:'SOURCE',product_id:'other',data:{_clickupDocPageUrl:'https://example.test/stored'}}];
  const result=inspirationContext('qa',rows,products,snapshots);
  assert.deepEqual(result.INS.products,[{id:'other',name:'Other'}]);assert.equal(result.import.inheritedBriefUrl,'https://example.test/stored');
  assert.equal(inspirationContext('qa',rows,[products[0]],snapshots).import.inheritedBriefUrl,'');
  assert.equal(inspirationContext('qa',rows,products,[]).INS.products.length,0);
});
test('brief detection only returns HTTPS ClickUp documents from description, fields or rich comments',()=>{
  const url='https://app.clickup.com/123/v/dc/abc/def';
  for(const task of [{description:`[Brief](${url})`},{custom_fields:[{value:url}]},{text_content:url}])assert.equal(findClickUpBrief(task),url);
  assert.equal(findClickUpBrief({},[{comment:[{text:`Brief https://app.clickup.com/abc/docs/def`}]}]),'https://app.clickup.com/abc/docs/def');
  for(const invalid of ['javascript:alert(1)','http://app.clickup.com/abc/docs/def','https://app.clickup.com.evil.test/abc/docs/def','https://user:pass@app.clickup.com/abc/docs/def','https://app.clickup.com/t/task'])assert.equal(clickUpDocumentUrl(invalid),'');
});
test('unavailable-audio variants are suppressed while real narration, literal copy and duration survive',()=>{
  for(const voice of ['Audio present; exact transcript not verified','Audio track present; exact transcript unavailable on this worker. Visible captions are captured below.','Voice over present - transcript unavailable'])assert.equal(inspirationVoice(voice),'');
  assert.equal(inspirationVoice('No voice over'),'No voice over');assert.equal(inspirationVoice('A real narrated sentence.'),'A real narrated sentence.');
  const [row]=projectInspirationLibrary('qa',[{id:'INS',product_id:'qa',data:{duration_seconds:12.5,importTags:['Imported',null],creativeUSP:'Name \u2014 Detail',bodyCopy:'<script>x</script><br>Two'}}],[],[]);
  assert.equal(row.duration,'12.5s');assert.deepEqual(row.tags,['Imported']);assert.equal(row.formatDetail,'Detail');assert.equal(row.bodyCopy,'<script>x</script>\nTwo');
});
