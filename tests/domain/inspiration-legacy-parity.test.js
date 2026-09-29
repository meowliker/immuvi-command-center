import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { inspirationDuplicateState } from '../../lib/domain/inspiration-duplicates.js';
import { inspirationSuggestions } from '../../lib/domain/inspiration-mapping.js';
import { normalizeTaxonomyName, taxonomyKey, taxonomySimilarityScore, deriveTaxonomyStatus } from '../../lib/domain/taxonomy.js';

const legacy=readFileSync(new URL('../../immuvi-command-center.html',import.meta.url),'utf8');
function fragment(start,end) {
  const from=legacy.indexOf(start),to=legacy.indexOf(end,from+start.length);
  assert.ok(from>=0 && to>from,'Legacy parity reference must still exist');return legacy.slice(from,to);
}
const duplicateCode=fragment('function checkDuplicateCreative(ins)', '// Run dupe check on ALL classified inspirations');
const rankingCode=[
  ['function _taxonomyTopMatches(', 'function _storeInspirationTaxonomySuggestions('],
  ['function _taxonomyCreativeCount(', 'function _taxonomyMergeSuggestions('],
  ['function _taxonomyMergeTargetForName(', 'function _renderTaxonomyMergeSuggestions('],
  ['function _taxonomyCreatedMs(', 'function _preferredTaxonomyItem('],
].map(([start,end])=>fragment(start,end)).join('\n');
const row={id:'INS',productId:'qa',status:'Classified',angle:'Energy tools',persona:'Busy parents',funnelStage:'TOF',hookType:'Question',creativeStructure:'Testimonial'};
const plain=(value)=>JSON.parse(JSON.stringify(value));

test('automatic match levels and winner/loser/tested priority agree with the actual legacy detector',()=>{
  const statuses=['Winner','Mild Winner','Scale','Loser','Testing','Complete'];
  for(const status of statuses)for(const persona of ['Busy parents','Busy adults','Different'])for(const funnelStage of ['TOF','MOF','']) {
    const ads=[{id:'A',productId:'qa',formatName:'Existing',angle:'Energy help',persona,funnelStage,hookType:'Question',creativeStructure:'Testimonial',status}];
    const ins={...row};runInNewContext(`${duplicateCode}\ncheckDuplicateCreative(ins);`,{ADS:ads,ins});
    const current=inspirationDuplicateState(row,ads);
    assert.equal(current.duplicateType,ins._dupeType || '');assert.deepEqual(plain(current.duplicateMatches),plain(ins._dupeSimilar || []));
  }
});

test('live match ranking and preferred merge target agree with the legacy ranking functions',()=>{
  const names=['Energy tools','Energy tool','Energy resources','Unrelated'],statuses=['Winner','Testing','Ready to Launch','Loser','Untested'];
  const items=names.map((name,index)=>({id:String(index),product_id:'qa',name,created_at:`2026-01-0${index+1}`,createdAt:`2026-01-0${index+1}`}));
  for(const kind of ['angle','persona'])for(const detected of ['Energy','Energy tools',''])for(const status of statuses) {
    const ads=[{id:'A',productId:'qa',[kind]:'Energy tools',status:'Testing'},{id:'B',productId:'qa',[kind]:'Energy tool',status},{id:'C',productId:'qa',[kind]:'Energy resources',status}];
    const context={ANGLES:items,PERSONAS:items,ADS:ads,_normalizeTaxonomyName:normalizeTaxonomyName,_taxonomyLookupKey:taxonomyKey,_taxonomySimilarityScore:taxonomySimilarityScore,
      _taxonomyItemIsActive:()=>true,_isBoundaryQuarantinedTaxonomy:()=>false,_isBoundaryQuarantinedAd:()=>false,
      deriveAngleStatus:(name)=>deriveTaxonomyStatus('angle',name,ads),derivePersonaStatus:(name)=>deriveTaxonomyStatus('persona',name,ads),kind,detected};
    runInNewContext(`${rankingCode}\nvar list=_taxonomyTopMatches(kind,detected || 'Energy tools',100);var preferred=_taxonomyMergeTargetForName(kind,'Energy tools');if(preferred)list=[preferred].concat(list.filter(function(item){return item.name!==preferred.name;}));`,context);
    const source={...row,[kind]:'Energy tools',editFields:{[kind==='angle'?'detectedAngle':'detectedPersona']:detected}};
    const actual=inspirationSuggestions(source,kind,items,ads).filter((item)=>item.score>=.45).map(({name,score,status,creativeCount})=>({name,score,status,creativeCount}));
    assert.deepEqual(actual,plain(context.list));
  }
});
