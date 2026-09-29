import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCreativeRow } from '../../lib/domain/creative-tracker.js';
import { normalizeTaxonomyRow } from '../../lib/domain/taxonomy.js';
import { MATRIX_DEFAULTS, matrixKey, matrixBucket, matrixSearchMatches, matrixDateRange, matrixDateMatches, indexMatrix, classifyMatrixCell, sortMatrixAngles, moveMatrixAngle, matrixDecisions, normalizeMatrixInspiration } from '../../lib/domain/creative-matrix.js';
const axis=(id,name,extra={}) => normalizeTaxonomyRow({id,name,product_id:'qa',...extra});
const ad=(id,extra={}) => normalizeCreativeRow({ id,product_id:'qa',format_name:id,angle:'Energy',persona:'Busy people',status:'Untested',created_at:'2026-09-18T15:00:00',...extra });
const filters=(extra={}) => ({...MATRIX_DEFAULTS,...extra});
test('matrix search matches creative names, local and ClickUp IDs, or taxonomy without case sensitivity', () => {
  const rows=[ad('AD-123',{format_name:'Audience demo',clickup_task_id:'cu-456'})];
  for (const query of ['', '  ', 'DEMO', 'ad-123', 'CU-456', 'energy', 'busy']) assert.equal(matrixSearchMatches(query,'Energy','Busy people',rows),true);
  assert.equal(matrixSearchMatches('absent','Energy','Busy people',rows),false);
  assert.equal(matrixSearchMatches('demo','Energy','Busy people',[]),false);
});
test('same-day dates are inclusive through the last millisecond, invalid ranges fail closed', () => {
  const f=filters({dateRange:'custom',dateFrom:'2026-09-18',dateTo:'2026-09-18'});
  assert.equal(matrixDateMatches(ad('a'),f),true);
  assert.equal(matrixDateMatches(ad('b',{created_at:'2026-09-18T23:59:59.999'}),f),true);
  assert.equal(matrixDateMatches(ad('c',{created_at:'2026-09-19T00:00:00'}),f),false);
  assert.equal(matrixDateRange({...f,dateFrom:'2026-09-19'}).valid,false);
  assert.equal(matrixDateRange({...f,dateTo:'2026-02-30'}).valid,false);
  assert.equal(matrixDateMatches(ad('d',{created_at:null}),f),false);
});
test('scope rebases counts; highlight keeps lifetime counts and does not stack opacity', () => {
  const rows=[ad('new',{status:'Mild Winner'}),ad('old',{status:'Loser',created_at:'2026-01-01'})];
  const f=filters({dateRange:'custom',dateFrom:'2026-09-18',dateTo:'2026-09-18'});
  const scoped=classifyMatrixCell(rows,f); assert.equal(scoped.total,1);assert.equal(scoped.counts.winner,1);assert.equal(scoped.lifetimeTotal,2);
  const lifetime=classifyMatrixCell(rows,{...f,filterMode:'highlight'});assert.equal(lifetime.total,2);assert.equal(lifetime.matches,true);
  assert.equal(classifyMatrixCell(rows,{...f,statuses:['loser']}).total,0);
  assert.equal(matrixBucket('Mild Winner'),'winner');
});
test('each date basis uses the correct timestamp with legacy fallback', () => {
  const row=ad('a',{created_at:'2026-01-01',updated_at:'2026-09-18T16:00:00',last_status_change_at:new Date('2026-09-18T17:00:00').getTime()});
  const f=filters({dateRange:'custom',dateFrom:'2026-09-18',dateTo:'2026-09-18'});
  assert.equal(matrixDateMatches(row,f),false);assert.equal(matrixDateMatches(row,{...f,dateBasis:'updated'}),true);assert.equal(matrixDateMatches(row,{...f,dateBasis:'status'}),true);
});
test('canonical and explicit membership merge, alias IDs heal without inventing foreign or archived axes', () => {
  const angles=[axis('a','Energy'),axis('a2','Health'),axis('arch','Archived',{archived_at:'2026-01-01'}),axis('foreign','Foreign',{product_id:'other'})];
  const personas=[axis('p','Busy people')];
  const creatives=[ad('one',{clickup_task_id:'cu-one'}),ad('two'),ad('moved',{angle:'Health'}),ad('hidden',{meta:{_productBoundaryQuarantined:true}}),ad('foreign-ad',{product_id:'other'})];
  const cells=[{product_id:'qa',angle_id:'a',persona_id:'p',creative_assignments:['cu-one','one','moved','ghost']},{product_id:'other',angle_id:'a',persona_id:'p',creative_assignments:['foreign-ad']}];
  const index=indexMatrix({productId:'qa',angles,personas,creatives,cells});
  assert.equal(index.angles.length,2);
  assert.deepEqual(index.byCell.get(matrixKey('a','p')).map((ad) => ad.id),['one','two']);
  assert.deepEqual(index.byCell.get(matrixKey('a2','p')).map((ad) => ad.id),['moved']);
  assert.equal(index.unresolved.get(matrixKey('a','p')),1);
});
test('removed canonical creatives do not reappear and ambiguous aliases are not guessed', () => {
  const index=indexMatrix({productId:'qa',angles:[axis('a','Energy')],personas:[axis('p','Busy people')],creatives:[ad('one'),ad('x',{angle:'',clickup_task_id:'dup'}),ad('y',{angle:'',clickup_task_id:'dup'})],
    cells:[{product_id:'qa',angle_id:'a',persona_id:'p',creative_assignments:['one','dup'],meta:{_excludedCreativeIds:['one']}}]});
  assert.deepEqual(index.byCell.get(matrixKey('a','p')),[]);assert.equal(index.unresolved.get(matrixKey('a','p')),1);
});
test('angle sorts and manual movement never mutate canonical taxonomy', () => {
  const angles=[axis('a','Energy'),axis('b','Health')];const before=structuredClone(angles);
  const states=new Map([[matrixKey('a','p'),classifyMatrixCell([ad('1')],filters())],[matrixKey('b','p'),classifyMatrixCell([ad('2'),ad('3')],filters())]]);
  assert.equal(sortMatrixAngles(angles,states,filters({sort:'mostCreatives'}))[0].id,'b');
  assert.equal(sortMatrixAngles(angles,states,filters({sort:'nameDesc'}))[0].id,'b');
  assert.deepEqual(moveMatrixAngle(['a','b','c'],'a','c'),['b','c','a']);
  assert.deepEqual(moveMatrixAngle(['a','b','c'],'c','a'),['c','a','b']);
  assert.deepEqual(angles,before);
});
test('decision tiles and scoped empty gaps use the same cell statistics', () => {
  const states=new Map([[matrixKey('a','p'),classifyMatrixCell([ad('w',{status:'Winner'})],filters())],[matrixKey('a','q'),classifyMatrixCell([],filters())]]);
  const result=matrixDecisions(states);assert.equal(result.winners.length,1);assert.equal(result.replicate.length,1);assert.equal(result.gaps.length,1);
});
test('pending inspirations do not display fabricated classification fields', () => {
  const pending=normalizeMatrixInspiration({id:'i',status:'Queued',data:{adType:'Video',funnelStage:'TOF'}});
  assert.equal(pending.pending,true);assert.equal(pending.adType,'');assert.equal(pending.funnelStage,'');
});
