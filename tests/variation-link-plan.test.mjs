import test from 'node:test';
import assert from 'node:assert/strict';
import {planVariationLinks,inspectLivePair,relatedTaskIds} from '../scripts/lib/variation-link-plan.mjs';
const products=[{id:'A',config:{clickup_list_id:'L'}},{id:'B',config:{clickup_list_id:'M'}}];
const parent={id:'p',product_id:'A',clickup_task_id:'cp'};
const child={id:'v',parent_ad_id:'p',product_id:'A',clickup_task_id:'cv'};
test('exact same-product parents, including nested variations, are planned',()=>{
  const r=planVariationLinks(products,[parent,child,{id:'vv',product_id:'A',parent_ad_id:'v',clickup_task_id:'cvv'}],[]);
  assert.equal(r.pairs.length,2);assert.equal(r.pairs[1].parentTaskId,'cv');assert.equal(r.skipped.length,0);
});
test('deleted, quarantined, unpublished, foreign and cyclic identities are not repaired',()=>{
  for(const [ads,tombs,reason] of [
    [[parent,{...child,quarantined:true}],[],'protected-deletion-or-quarantine'],
    [[parent,child],[{id:'v',product_id:'A'}],'protected-deletion-or-quarantine'],
    [[parent,child],[{id:'old',product_id:'A',clickup_task_id:'cp'}],'protected-parent'],
    [[{...parent,deleted_at:'date'},child],[],'protected-parent'],
    [[{...parent,product_id:'B'},child],[],'cross-product-parent'],
    [[parent,{...child,clickup_task_id:null}],[],'not-published-to-clickup'],
    [[parent,{...child,clickup_task_id:'cp'}],[],'self-link'],
    [[{...parent,parent_ad_id:'v'},child],[],'parent-cycle'],
    [[child],[],'missing-parent-record'],
    [[parent,child,{id:'alias',product_id:'B',clickup_task_id:'cp'}],[],'ambiguous-task-ownership']
  ]) {const r=planVariationLinks(products,ads,tombs);assert.equal(r.pairs.length,0);assert.ok(r.skipped.some(s=>s.reason===reason),reason);}
});
test('conflicting aliases cannot link a task to two different parents',()=>{
  const r=planVariationLinks(products,[parent,child,{id:'p2',product_id:'A',clickup_task_id:'cp2'},{...child,id:'alias',parent_ad_id:'p2'}],[]);
  assert.equal(r.pairs.length,0);assert.equal(r.skipped.length,2);
});
test('duplicate aliases produce one relationship and names never choose a parent',()=>{
  const rows=[parent,child,{...child,id:'alias'},{...parent,id:'same-name',format_name:'Winner',clickup_task_id:'other'}];
  const before=structuredClone(rows);
  const r=planVariationLinks(products,rows,[]);
  assert.equal(r.pairs.length,1);
  assert.equal(r.pairs[0].parentTaskId,'cp');
  assert.deepEqual(rows,before);
});
test('string quarantine, parent quarantine, missing lists and child task tombstones are protected',()=>{
  for(const [ps,rows,tombs,reason] of [
    [products,[parent,{...child,quarantined:'true'}],[],'protected-deletion-or-quarantine'],
    [products,[{...parent,quarantined:true},child],[],'protected-parent'],
    [[{id:'A',config:{}}],[parent,child],[],'missing-product-list'],
    [products,[parent,child],[{id:'retired-alias',product_id:'A',clickup_task_id:'cv'}],'protected-deletion-or-quarantine']
  ]) {
    const r=planVariationLinks(ps,rows,tombs);
    assert.equal(r.pairs.length,0);assert.equal(r.skipped[0].reason,reason);
  }
  assert.equal(planVariationLinks(products,[parent,child],[{id:'v',product_id:'B'}]).pairs.length,1);
});
test('live validation checks list and both sides of relationship',()=>{
  const pair=planVariationLinks(products,[parent,child],[]).pairs[0];
  const a={id:'cv',list:{id:'L'},linked_tasks:[]},b={id:'cp',list:{id:'L'},linked_tasks:[]};
  assert.equal(inspectLivePair(pair,a,b),'missing');
  assert.equal(inspectLivePair(pair,a,{...b,list:{id:'M'}}),'clickup-list-mismatch');
  assert.equal(inspectLivePair(pair,a,{...b,archived:true}),'archived-clickup-task');
  assert.equal(inspectLivePair(pair,null,b),'missing-clickup-task');
  assert.equal(inspectLivePair(pair,a,{...b,linked_tasks:undefined}),'relationships-unavailable');
  a.linked_tasks=[{task_id:'cv',link_id:'cp'}];b.linked_tasks=[{task_id:'cv',link_id:'cp'}];
  assert.equal(inspectLivePair(pair,a,b),'linked');assert.deepEqual(relatedTaskIds(b),['cv']);
});
test('one-sided relationships and unrelated links do not falsely pass verification',()=>{
  const pair=planVariationLinks(products,[parent,child],[]).pairs[0];
  const a={id:'cv',list:{id:'L'},linked_tasks:[{task_id:'cv',link_id:'cp'}]};
  const b={id:'cp',list:{id:'L'},linked_tasks:[{task_id:'elsewhere',link_id:'cv'}]};
  assert.equal(inspectLivePair(pair,a,b),'missing');
  assert.deepEqual(relatedTaskIds(b),[]);
  assert.equal(inspectLivePair(pair,{...a,id:'wrong'},b),'clickup-identity-mismatch');
});
