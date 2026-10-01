import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

for (const file of ['immuvi-command-center.html','public/immuvi-command-center.html']) {
  const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  const helpers=html.slice(html.indexOf('function _variationParentForClickUp('),html.indexOf('function createClickUpTaskFromAction('));
  function setup() {
    const calls=[],tasks={parent:{id:'parent',list:{id:'list'},linked_tasks:[]},child:{id:'child',list:{id:'list'},linked_tasks:[]}};
    const state={fail:false,confirm:true};
    const c=vm.createContext({console,window:{_pendingCu:[]},toast(){},_renderSyncBanner(){},_withCloudTimeout:p=>p,
      _isBoundaryQuarantinedAd:a=>!!a.quarantined,
      apiFetch:async(path,opts)=>{
        calls.push({path,opts});
        if(state.fail)throw Error('network unavailable');
        if(opts?.method==='POST') {
          if(state.confirm)tasks.child.linked_tasks.push({task_id:'child',link_id:'parent'});
          return {};
        }
        return structuredClone(tasks[path.split('/')[2]]);
      }});
    vm.runInContext(helpers,c);return {c,calls,tasks,state};
  }
  test(file+': parent resolution uses identity, not inspiration/source or name',()=>{
    const {c}=setup(),parent={id:'p',clickupTaskId:'parent',formatName:'Winner'},ad={id:'v',parentAdId:'p',_fromInspoId:'inspo',_sourceClickupId:'wrong'};
    assert.equal(c._variationParentForClickUp(ad,{},'A','A',[parent,ad]).taskId,'parent');
    assert.equal(c._variationParentForClickUp({id:'v'}, {},'A','A',[]),null);
    assert.equal(c._variationParentForClickUp({id:'v'}, {parentAdId:'p'},'A','A',[parent]).taskId,'parent');
    const nested={id:'n',parentAdId:'v'};ad.clickupTaskId='child';
    assert.equal(c._variationParentForClickUp(nested,{},'A','A',[parent,ad,nested]).taskId,'child');
  });
  test(file+': unavailable, foreign, deleted and conflicting parents are blocked',()=>{
    const {c}=setup(),ad={id:'v',parentAdId:'p'},parent={id:'p',_clickupId:'parent'};
    for(const p of [null,{...parent,product_id:'B'},{...parent,deleted_at:'date'},{...parent,quarantined:true},{id:'p'}]) {
      assert.throws(()=>c._variationParentForClickUp(ad,{},'A','A',p?[p]:[]));
    }
    assert.throws(()=>c._variationParentForClickUp(ad,{},'A','B',[parent]));
    assert.throws(()=>c._variationParentForClickUp(ad,{parentAdId:'other'},'A','A',[parent]));
  });
  test(file+': creates and verifies only the exact same-list relationship',async()=>{
    const {c,calls}=setup();assert.equal(await c._syncVariationParentLink('child','parent','list'),true);
    const writes=calls.filter(x=>x.opts);assert.equal(writes.length,1);
    assert.equal(writes[0].path,'/task/child/link/parent');assert.equal(writes[0].opts.method,'POST');
    assert.equal(c.window._pendingCu.length,0);
    await c._syncVariationParentLink('child','parent','list');
    assert.equal(calls.filter(x=>x.opts).length,1);
  });
  test(file+': reverse relationship orientation also prevents duplicate linking',async()=>{
    const {c,calls,tasks}=setup();tasks.child.linked_tasks=[{task_id:'parent',link_id:'child'}];
    assert.equal(await c._syncVariationParentLink('child','parent','list'),true);
    assert.equal(calls.filter(x=>x.opts).length,0);
  });
  test(file+': cross-product lists, archived tasks and self-links cannot write',async()=>{
    for(const mode of ['list','archived','self']) {
      const {c,calls,tasks}=setup();if(mode==='list')tasks.parent.list.id='foreign';if(mode==='archived')tasks.parent.archived=true;
      assert.equal(await c._syncVariationParentLink('child',mode==='self'?'child':'parent','list'),false);
      assert.equal(calls.filter(x=>x.opts).length,0);
    }
  });
  test(file+': failed or unverified links queue once and retry only the relationship',async()=>{
    const {c,state}=setup();state.fail=true;
    await c._syncVariationParentLink('child','parent','list');await c._syncVariationParentLink('child','parent','list');
    assert.equal(c.window._pendingCu.length,1);assert.equal(c.window._pendingCu[0].kind,'variation-parent-link');
    state.fail=false;state.confirm=false;
    assert.equal(await c._syncVariationParentLink('child','parent','list'),false);
    state.confirm=true;assert.equal(await c._syncVariationParentLink('child','parent','list'),true);
    assert.equal(c.window._pendingCu.length,0);
    assert.ok(html.includes("if (w.kind === 'variation-parent-link') _syncVariationParentLink(w.taskId, w.parentTaskId, w.listId);"));
  });
  test(file+': task creation awaits independent parent linking; normal format flow remains',()=>{
    assert.ok(html.includes('variationParent = _variationParentForClickUp(sourceAd, act, activeProductId, _adsProductId, ADS)'));
    assert.ok(html.includes('await _syncVariationParentLink(newId, variationParent.taskId, listId)'));
    assert.ok(html.includes('if (!variationParent) apiFetch'));
    assert.ok(html.includes('Task created; winner link needs retry.'));
    for(const [,attrs,body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!/type="module"|src=/.test(attrs))new vm.Script(body);
  });
}
