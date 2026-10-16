import assert from 'node:assert/strict';
import test from 'node:test';
import {createDeleteCreativeHandler} from '../api/delete-creative.js';

function setup(change={}) {
  const state={matches:[{id:'canonical',product_id:'A',clickup_task_id:'cu'}],...change};const calls=[];
  const reply=(status,body)=>({ok:status===200,status,json:async()=>body});let rpc=0;
  const handler=createDeleteCreativeHandler({env:{SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'public-key'},fetchImpl:async(url,opts)=>{
    calls.push({url,opts});assert.equal(opts.headers.Authorization,'Bearer caller');
    if(url.includes('/rpc/delete_orphan_action'))return reply(404,{code:'P0002'});
    if(url.includes('/rpc/')){
      rpc++;const b=JSON.parse(opts.body);
      assert.equal(b.p_product_id,'A');assert.equal(b.p_expected_clickup_id,'cu');
      if(rpc===1){assert.equal(b.p_ad_id,'alias');return reply(state.initialStatus||404,{code:state.initialCode||'P0002'});}
      assert.equal(b.p_ad_id,'canonical');
      return state.conflict?reply(409,{code:'PT409'}):reply(200,{id:state.wrongCommit?'other':'canonical',productId:'A',deletedAt:'2026-10-16T06:00:00Z',clickupTaskIds:['cu']});
    }
    if(url.includes('clickup_task_id=')){
      assert.ok(url.includes('product_id=eq.A'));assert.ok(url.includes('limit=2'));
      return reply(state.lookupStatus||200,state.matches);
    }
    assert.ok(url.includes('id=eq.canonical')&&url.includes('product_id=eq.A'));
    return reply(200,[{id:state.badReadback?'alias':'canonical',deleted_at:'2026-10-16T06:00:00Z'}]);
  }});
  const req={method:'POST',headers:{authorization:'Bearer caller'},body:{adId:'alias',productId:'A',expectedClickUpId:'cu'}};
  const res={setHeader(){},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
  return {handler,req,res,calls};
}
test('missing display ID resolves exact saved ClickUp identity using only the caller JWT',async()=>{
  const {handler,req,res,calls}=setup();await handler(req,res);
  assert.equal(res.statusCode,200);assert.equal(res.body.id,'alias');assert.equal(res.body.canonicalId,'canonical');assert.equal(res.body.verified,true);
  assert.equal(calls.length,4);assert.ok(calls.every(c=>c.url.startsWith('https://db.test/')));
});
test('ambiguous, missing, foreign, changed and unverifiable identities never produce deletion success',async()=>{
  for(const [change,status,writes] of [
    [{matches:[]},404,1], [{matches:[{},{}]},409,1],
    [{matches:[{id:'canonical',product_id:'B',clickup_task_id:'cu'}]},409,1],
    [{matches:[{id:'canonical',product_id:'A',clickup_task_id:'other'}]},409,1],
    [{matches:[{id:'alias',product_id:'A',clickup_task_id:'cu'}]},409,1],
    [{lookupStatus:503},503,1], [{lookupStatus:401},401,1], [{lookupStatus:403},403,1], [{conflict:true},409,2],
    [{wrongCommit:true},502,2], [{badReadback:true},502,2],
  ]){
    const {handler,req,res,calls}=setup(change);await handler(req,res);
    assert.equal(res.statusCode,status);assert.ok(!res.body.verified);assert.equal(calls.filter(c=>c.url.includes('/rpc/delete_creative')).length,writes);
  }
});
test('authorization and existing identity conflicts cannot trigger alias resolution',async()=>{
  for(const [initialStatus,initialCode] of [[403,'42501'],[409,'PT409'],[401,'PGRST301']]){
    const {handler,req,res,calls}=setup({initialStatus,initialCode});await handler(req,res);
    assert.equal(res.statusCode,initialStatus);assert.equal(calls.length,1);
  }
});
