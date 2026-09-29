import test from 'node:test';
import assert from 'node:assert/strict';
import { inspirationSuggestions } from '../../lib/domain/inspiration-mapping.js';
import { preferredMergeTarget } from '../../lib/domain/taxonomy.js';
const row={productId:'qa',angle:'Energy',editFields:{detectedAngle:'Energy'}};
const item=(id,name)=>({id,name,product_id:'qa',created_at:'2026-01-01'});
const ad=(id,angle,status='Testing',extra={})=>({id,productId:'qa',angle,status,...extra});
test('match ties use derived status then root creative counts before name, ignoring stored and foreign performance',()=>{
  const items=[item('A','Energy help'),item('B','Energy tools'),item('C','Energy resources')];
  let ads=[ad('A','Energy help','Untested'),ad('B','Energy tools','Ready to Launch'),ad('C','Energy resources','Testing')];
  assert.deepEqual(inspirationSuggestions(row,'angle',items,ads).map((x)=>x.id),['B','C','A']);
  ads=[ad('B1','Energy tools'),ad('B2','Energy tools'),ad('C','Energy resources'),ad('F','Energy help','Winner',{productId:'other'}),ad('CHILD','Energy help','Winner',{parentAdId:'P',adOrigin:'Winner Variation'})];
  assert.equal(inspirationSuggestions(row,'angle',items,ads)[0].id,'B');
});
test('preferred merge target overrides a detected exact match using status, counts, name length and creation age',()=>{
  const items=[item('CURRENT','Energy tools'),item('PREFERRED','Energy tool')],source={...row,angle:'Energy tools',editFields:{detectedAngle:'Energy tools'}};
  assert.equal(inspirationSuggestions(source,'angle',items,[ad('WIN','Energy tool','Winner')])[0].id,'PREFERRED');
  assert.equal(inspirationSuggestions(source,'angle',items,[ad('WIN','Energy tools','Winner')])[0].id,'CURRENT');
  assert.equal(inspirationSuggestions(source,'angle',items,[])[0].id,'PREFERRED');
  const left={name:'Energy aid',createdAt:'2026-01-02'},right={name:'Energy kit',createdAt:'2026-01-01'},stats={creatives:0};
  assert.equal(preferredMergeTarget('angle',left,right,stats,stats,[]),right);
  assert.equal(preferredMergeTarget('angle',left,{...right,createdAt:null},stats,stats,[]).createdAt,null);
  assert.equal(inspirationSuggestions(source,'angle',[items[0],{...items[1],archived_at:'x'}],[ad('WIN','Energy tool','Winner')])[0].id,'CURRENT');
});
