import test from 'node:test';
import assert from 'node:assert/strict';
import { automaticDeletionReason as reason,planDuplicateVisibility,remapCell,remapAction } from '../scripts/lib/duplicate-visibility-plan.mjs';

const fixture = ()=>({
  products:[{id:'p',name:'Product',list_id:'list'}],
  ads:[{id:'task',product_id:'p',format_name:'Original',clickup_task_id:'task',deleted_at:null,source_list:'list'},
    {id:'AD-1',product_id:'p',clickup_task_id:'task',deleted_at:'2026-09-08'}],
  markers:[{id:'AD-1',product_id:'p',clickup_task_id:'task',deleted_by:reason}],
});
const verified = {task:{id:'task',name:'Original',listId:'list',archived:false}};
test('a verified retired duplicate is repairable',()=>assert.equal(planDuplicateVisibility(fixture(),verified).repairs.length,1));
for (const [name,change] of [
  ['deliberate deletion',s=>s.markers.push({id:'user-deletion',product_id:'p',clickup_task_id:'task',deleted_by:'User'})],
  ['unknown self-heal intent',s=>s.markers.push({id:'old',product_id:'p',clickup_task_id:'task',deleted_by:'self-heal'})],
  ['deleted canonical',s=>s.ads[0].deleted_at='2026-09-09'],
  ['cross-product canonical',s=>s.ads[0].product_id='other'],
  ['canonical identity mismatch',s=>s.ads[0].clickup_task_id='other'],
  ['different duplicate identity',s=>s.ads[1].clickup_task_id='other'],
  ['revived duplicate',s=>s.ads[1].deleted_at=null],
  ['conflicting supersession',s=>s.ads[1].superseded_by='other'],
  ['conflicting source list',s=>s.ads[0].source_list='other'],
  ['canonical deletion marker',s=>s.markers[0].id='task'],
]) test(`preserves ${name}`,()=>{const s=fixture();change(s);assert.equal(planDuplicateVisibility(s,verified).repairs.length,0);});
for (const [name,remote] of [['missing',{}],['failed',{task:{error:'HTTP 404'}}],
  ['archived',{task:{...verified.task,archived:true}}],['wrong list',{task:{...verified.task,listId:'other'}}]]) {
  test(`rejects ${name} ClickUp evidence`,()=>assert.equal(planDuplicateVisibility(fixture(),remote).repairs.length,0));
}
test('missing retired rows do not prevent marker-only repair',()=>{
  const s=fixture();s.ads.pop();const [repair]=planDuplicateVisibility(s,verified).repairs;
  assert.equal(repair.hasDuplicate,false);
});
test('reused IDs in another product never authorize touching that row',()=>{
  const s=fixture();s.ads[1]={id:'AD-1',product_id:'other',clickup_task_id:'different',deleted_at:null};
  const [repair]=planDuplicateVisibility(s,verified).repairs;
  assert.equal(repair.hasDuplicate,false);assert.equal(repair.foreignIdReused,true);
});
test('verified source list authorizes correction of stale product routing only',()=>{
  const s=fixture();s.ads[0].sync_product='other';assert.equal(planDuplicateVisibility(s,verified).repairs[0].normalizeRouting,true);
});
test('already repaired pairs produce no work',()=>{
  const s=fixture();s.markers[0].clickup_task_id=null;s.ads[1].clickup_task_id=null;s.ads[1].superseded_task='task';
  assert.equal(planDuplicateVisibility(s,verified).repairs.length,0);
});
test('cell mapping preserves order, metadata and canonical overrides',()=>{
  const cell={creative_assignments:['AD-1','keep','task'],meta:{keep:1,per_ad:{'AD-1':{status:'Testing',due:'date'},task:{status:'Winner'}}}};
  const result=remapCell(cell,new Map([['AD-1','task']]));
  assert.deepEqual(result,{creative_assignments:['task','keep'],meta:{keep:1,per_ad:{task:{status:'Winner',due:'date'}}}});
  assert.equal(cell.creative_assignments[0],'AD-1');
});
test('action mapping changes only exact linkage fields',()=>{
  const action={payload:{sourceAdId:'AD-1',_sourceAdId:'AD-1',adId:'AD-1',title:'AD-1',brief:'keep'},live_status:'Winner'};
  assert.deepEqual(remapAction(action,new Map([['AD-1','task']])),{payload:{sourceAdId:'task',_sourceAdId:'task',adId:'task',title:'AD-1',brief:'keep'},live_status:'Winner'});
});
