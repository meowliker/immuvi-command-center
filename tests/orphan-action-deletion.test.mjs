import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {createDeleteCreativeHandler} from '../api/delete-creative.js';

const actionId='8caa32cc-e4e8-4114-814a-dab7c5d4fbfe';
const preview={id:'AD-12837',productId:'AR',actionId,actionLocalId:'manual-target',
  markerId:'orphan-action:AR:'+actionId,taskName:'AR-261-INS-127',
  clickupTaskIds:['target-cu'],preview:true,deletedAt:null};

function api(change={}) {
  const state={...change},calls=[];
  const reply=(status,body)=>({status,ok:status===200,json:async()=>body});
  const handler=createDeleteCreativeHandler({env:{SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'anon'},fetchImpl:async(url,opts)=>{
    calls.push({url,opts});assert.equal(opts.headers.Authorization,'Bearer caller');
    assert.ok(url.startsWith('https://db.test/'),'Never contact or delete a ClickUp task');
    if(url.includes('/rpc/delete_creative'))return reply(404,{code:'P0002'});
    if(url.includes('/rpc/delete_orphan_action')){
      const b=JSON.parse(opts.body);assert.equal(b.p_product_id,'AR');assert.equal(b.p_source_ad_id,'AD-12837');assert.equal(b.p_expected_clickup_id,'target-cu');
      if(state.rpcError)return reply(state.rpcError,{code:state.rpcCode||'PT409'});
      return reply(200,{...preview,...state.preview,preview:!b.p_confirm,
        deletedAt:b.p_confirm?'2026-10-16T10:00:00Z':null});
    }
    if(url.includes('/ads?'))return reply(200,[]);
    if(url.includes('/deleted_ads?'))return reply(200,[{id:preview.markerId,product_id:'AR',clickup_task_id:'target-cu',deleted_at:'2026-10-16T10:00:00Z',...state.marker}]);
    if(url.includes('/manual_actions?'))return reply(200,state.remainingAction?[{id:actionId}]:[]);
    throw Error('Unexpected request');
  }});
  const req={method:'POST',headers:{authorization:'Bearer caller'},body:{adId:'AD-12837',productId:'AR',expectedClickUpId:'target-cu'}};
  const res={setHeader(){},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
  return {handler,req,res,calls};
}
test('missing creative offers a read-only orphan preview and never commits automatically',async()=>{
  const {handler,req,res,calls}=api();await handler(req,res);
  assert.equal(res.statusCode,409);assert.equal(res.body.code,'ORPHAN_ACTION_CONFIRMATION_REQUIRED');
  assert.equal(res.body.preview.actionId,actionId);assert.ok(calls.every(c=>!JSON.parse(c.opts.body||'{}').p_confirm));
  assert.equal(calls.filter(c=>c.url.includes('delete_orphan_action')).length,1);
});
test('explicit confirmation removes only the selected action and verifies the scoped marker',async()=>{
  const {handler,req,res,calls}=api();Object.assign(req.body,{actionId,confirmOrphanAction:true});await handler(req,res);
  assert.equal(res.statusCode,200);assert.equal(res.body.kind,'orphan_action');assert.equal(res.body.skipClickUpDelete,true);
  assert.equal(res.body.verified,true);assert.equal(calls.length,3);
  assert.ok(!calls.some(c=>c.url.includes('/ads?')||c.url.includes('delete_creative')));
  assert.equal(JSON.parse(calls[0].opts.body).p_confirm,true);
});
test('invalid confirmation, changed identities, access errors and bad readbacks never report success',async()=>{
  for(const [change,status] of [[{preview:{productId:'OTHER'}},409],[{preview:{clickupTaskIds:['wrong']}},409],
    [{preview:{markerId:'AD-12837'}},409],[{rpcError:403,rpcCode:'42501'},403],
    [{rpcError:409},409],[{remainingAction:true},502],[{marker:{product_id:'OTHER'}},502]]){
    const {handler,req,res}=api(change);Object.assign(req.body,{actionId,confirmOrphanAction:true});await handler(req,res);
    assert.equal(res.statusCode,status);assert.ok(!res.body.verified);
  }
  for(const change of [{confirmOrphanAction:true},{actionId:'invalid',confirmOrphanAction:true},{confirmOrphanAction:'yes'}]){
    const {handler,req,res,calls}=api();Object.assign(req.body,change);await handler(req,res);assert.equal(res.statusCode,400);assert.equal(calls.length,0);
  }
});

for(const file of ['immuvi-command-center.html','public/immuvi-command-center.html']) {
  const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  function browser(change={}) {
    const calls={requests:[],clickup:[],saves:[],broadcasts:[],tombstones:[],confirmations:0};
    const state={accept:true,...change};
    const c=vm.createContext({console,Date,Set,AbortSignal,activeProductId:'AR',_adsProductId:'AR',_uiProductGeneration:1,
      _productSwitchPending:false,_cloudLoadFailed:false,AUTH:{},CFG:{key:'personal-key'},ADS:[{id:'unrelated',notes:'keep'}],
      MANUAL_ACTIONS:[{id:'manual-target',_dbId:actionId,sourceAdId:'AD-12837',_clickupId:'target-cu'},
        {id:'keep',_dbId:'other',sourceAdId:'unrelated',_clickupId:'other-cu'}],PROD:[{adId:'unrelated'}],INSPIRATIONS:[{id:'keep'}],
      _deletedAdIdsCache:new Set(),_deletedAdClickUpIdsCache:new Set(),_myClientId:'self',
      SB:{auth:{getSession:async()=>({data:{session:{access_token:'caller'}}})}},
      _rtChannel:{send:m=>calls.broadcasts.push(m)},_withCloudTimeout:async p=>p,
      _saveScheduled:null,_saveQueue:Promise.resolve(),_flushStateToSupabase:async()=>calls.saves.push('flush'),
      setTimeout:f=>{f();return 1;},clearTimeout(){},localStorage:{getItem:()=>null,setItem(){}},
      toast(){},_rememberAdDeletion(){throw Error('Cannot tombstone a foreign source alias');},_rememberManualActionDeletion(){},
      purgeOrphanedMatrixKeys(){throw Error('Cannot change unrelated matrix cells');},
      process:()=>({}),deriveWinners(){},genActions(){},buildCreativeUsageIndex(){},populateFilterOptions(){},renderAll(){},rebuildProdFromManual(){},
      window:{_apTombstoneAdd:t=>calls.tombstones.push(t)},apiDeleteTask:async(...args)=>calls.clickup.push(args),
      fetch:async(url,opts)=>{
        calls.requests.push({url,opts});const b=JSON.parse(opts.body);
        if(b.confirmOrphanAction){
          if(state.afterCommit)state.afterCommit(c);
          return {ok:!state.commitFailure,status:state.commitFailure?409:200,json:async()=>state.commitFailure?{error:'Changed'}:
            {...preview,preview:false,deletedAt:'2026-10-16T10:00:00Z',kind:'orphan_action',skipClickUpDelete:true,verified:true}};
        }
        return {ok:false,status:409,json:async()=>({code:'ORPHAN_ACTION_CONFIRMATION_REQUIRED',preview:{...preview,...state.preview}})};
      }
    });
    c.confirm=()=>{calls.confirmations++;if(state.duringConfirm)state.duringConfirm(c);return state.accept;};
    vm.runInContext(html.slice(html.indexOf('function _isSupabaseAuthError('),html.indexOf('function openEditCreative(')),c);
    return {c,calls,state};
  }
  test(file+': cancellation and failed confirmation leave all entries and creatives unchanged',async()=>{
    for(const change of [{accept:false},{commitFailure:true},{preview:{productId:'OTHER'}}]){
      const {c,calls}=browser(change),before=JSON.stringify([c.ADS,c.MANUAL_ACTIONS,c.PROD,c.INSPIRATIONS]);
      await c.deleteAdEverywhere('AD-12837',{actionId});
      assert.equal(JSON.stringify([c.ADS,c.MANUAL_ACTIONS,c.PROD,c.INSPIRATIONS]),before);
      assert.equal(calls.clickup.length+calls.saves.length+calls.broadcasts.length+calls.tombstones.length,0);
    }
  });
  test(file+': only a second explicit confirmation removes the exact action, never a source creative or ClickUp task',async()=>{
    const {c,calls,state}=browser();const before=JSON.stringify([c.ADS,c.PROD,c.INSPIRATIONS]);
    c.MANUAL_ACTIONS.push({id:'sibling',_dbId:'other-sibling',sourceAdId:'AD-12837',_clickupId:'sibling-cu'});
    state.duringConfirm=()=>{assert.equal(calls.requests.length,1);assert.equal(c.MANUAL_ACTIONS.length,3);assert.equal(calls.tombstones.length,0);};
    await c.deleteAdEverywhere('AD-12837',{actionId});
    assert.equal(calls.confirmations,1);assert.equal(calls.requests.length,2);
    assert.equal(JSON.parse(calls.requests[0].opts.body).confirmOrphanAction,undefined);
    assert.equal(JSON.parse(calls.requests[1].opts.body).confirmOrphanAction,true);
    assert.equal(JSON.stringify([c.ADS,c.PROD,c.INSPIRATIONS]),before);
    assert.deepEqual(Array.from(c.MANUAL_ACTIONS,a=>a.id),['keep','sibling']);
    assert.equal(calls.clickup.length+calls.saves.length+calls.broadcasts.length,0);
    assert.equal(calls.tombstones[0].adid,'');assert.equal(calls.tombstones[0].title,'');
    assert.equal(c._deletedAdIdsCache.size+c._deletedAdClickUpIdsCache.size,0);
  });
  test(file+': switching products before or after confirmation never mutates the new product',async()=>{
    for(const phase of ['duringConfirm','afterCommit']){
      const {c,calls,state}=browser();state[phase]=context=>{context.activeProductId=context._adsProductId='OTHER';context._uiProductGeneration++;context.MANUAL_ACTIONS=[{id:'foreign-keep'}];};
      await c.deleteAdEverywhere('AD-12837',{actionId});assert.equal(c.MANUAL_ACTIONS[0].id,'foreign-keep');
      assert.equal(calls.clickup.length+calls.saves.length+calls.broadcasts.length,0);
      assert.equal(calls.requests.length,phase==='duringConfirm'?1:2);
    }
  });
}
