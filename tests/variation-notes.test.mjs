import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {createVariationNotesHandler} from '../api/variation-notes.js';
for (const file of ['immuvi-command-center.html','public/immuvi-command-center.html']) {
  const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  const code=html.slice(html.indexOf('function _variationNotesText('),html.indexOf('function saveAdNotes('));
  function setup() {
    const calls=[],state={status:200,verified:true,refreshes:0};
    const c=vm.createContext({console,activeProductId:'A',_adsProductId:'A',_uiProductGeneration:1,_productSwitchPending:false,_cloudLoadFailed:false,_notesCache:{},
      ADS:[{id:'v1',parentAdId:'p1',notes:'Original',status:'Testing'},{id:'other',notes:'Keep'}],
      esc:s=>String(s).replaceAll('<','&lt;'),escAttr:String,_withCloudTimeout:async p=>p,
      SB:{auth:{getSession:async()=>({data:{session:{access_token:'user-token'}}})}},
      _refreshSupabaseWriteSession:async()=>{state.refreshes++;state.status=200;return true;},
      fetch:async(url,opts)=>{calls.push({url,opts});if(state.afterSend)state.afterSend();const b=JSON.parse(opts.body);
        return {ok:state.status===200,status:state.status,json:async()=>state.status===200?
          {id:b.adId,productId:state.wrongProduct?'B':b.productId,notes:b.notes,verified:state.verified}:{error:'Rejected',code:'TEST_ERROR'}};}
    });vm.runInContext(code,c);return {c,calls,state};
  }
  test(file+': escaped truncated preview and short notes',()=>{
    const {c}=setup();const s=c._variationNotesCell({id:'v1',notes:'<script>'+'x'.repeat(200)});
    assert.ok(s.includes('&lt;script>'));assert.ok(s.includes('...</button>'));assert.ok(s.includes('event.stopPropagation()'));
    assert.ok(c._variationNotesCell({id:'v1',notes:'Short'}).includes('Short</button>'));
    assert.equal(c._variationNotesText({notes:'',variationNotes:'Old'}),'');
    assert.ok(html.includes('<th>Due</th><th>Notes</th><th>ClickUp</th>'));
  });
  test(file+': only same-origin POST; notes-only local update after verified save',async()=>{
    const {c,calls}=setup();await c._saveVariationNotes('v1','A',1,'Original',' New ');
    assert.equal(calls[0].url,'/api/variation-notes');assert.equal(calls[0].opts.method,'POST');
    assert.equal(calls[0].opts.headers.Authorization,'Bearer user-token');
    assert.deepEqual(JSON.parse(calls[0].opts.body),{adId:'v1',productId:'A',original:'Original',notes:'New'});
    assert.equal(c.ADS[0].notes,'New');assert.equal(c.ADS[0].status,'Testing');assert.equal(c.ADS[1].notes,'Keep');
    for(const s of ['SB.from(','.upsert(','.delete(','apiUpdateTask(','_flushStateToSupabase('])assert.ok(!code.includes(s));
  });
  test(file+': product guards block all requests',async()=>{
    for(const change of [{activeProductId:'B'},{_adsProductId:'B'},{_uiProductGeneration:2},{_productSwitchPending:true},{_cloudLoadFailed:true}]){
      const {c,calls}=setup();Object.assign(c,change);await assert.rejects(c._saveVariationNotes('v1','A',1,'Original','New'));assert.equal(calls.length,0);
    }
  });
  test(file+': product switched during save never receives old-product notes',async()=>{
    const {c,state}=setup();state.afterSend=()=>{c.activeProductId='B';c.ADS=[{id:'v1',notes:'Other'}];};
    await c._saveVariationNotes('v1','A',1,'Original','New');assert.equal(c.ADS[0].notes,'Other');
  });
  test(file+': failures and invalid readback preserve local notes',async()=>{
    for(const change of [{status:409},{status:503},{verified:false},{wrongProduct:true}]){
      const {c,state}=setup();Object.assign(state,change);await assert.rejects(c._saveVariationNotes('v1','A',1,'Original','New'));assert.equal(c.ADS[0].notes,'Original');
    }
  });
  test(file+': session retry is bounded and preserves request',async()=>{
    const {c,state,calls}=setup();state.status=401;await c._saveVariationNotes('v1','A',1,'Original','New');
    assert.equal(state.refreshes,1);assert.equal(calls.length,2);assert.equal(calls[0].opts.body,calls[1].opts.body);
  });
  test(file+': empty notes save; oversized notes fail without a request',async()=>{
    const {c,calls}=setup();await c._saveVariationNotes('v1','A',1,'Original','');assert.equal(c.ADS[0].notes,'');
    await assert.rejects(c._saveVariationNotes('v1','A',1,'','x'.repeat(20001)),/20,000/);assert.equal(calls.length,1);
  });
  test(file+': popup retains drafts and all inline scripts parse',()=>{
    assert.ok(code.includes('error.textContent = e.message'));assert.ok(code.includes('dialog.showModal()'));
    assert.ok(html.includes('body.varlab-notes-open { overflow: hidden; }'));
    for(const [,attrs,body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!/type="module"|src=/.test(attrs))new vm.Script(body);
  });
}
function server() {
  const calls=[],state={status:200,error:null,readback:'New'};
  const handler=createVariationNotesHandler({env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-key'},fetchImpl:async(url,opts)=>{
    calls.push({url,opts});return url.includes('/rpc/')?{ok:state.status===200,status:state.status,json:async()=>state.error||{id:'v1',productId:'A',notes:'New'}}:
    {ok:true,json:async()=>[{id:'v1',meta:{notes:state.readback}}]};
  }});
  const req={method:'POST',headers:{authorization:'Bearer user-token'},body:{adId:'v1',productId:'A',original:'Original',notes:'New'}};
  const res={setHeader(){},status(n){this.statusCode=n;return this;},json(b){this.body=b;return this;}};
  return {handler,req,res,calls,state};
}
test('API keeps caller identity and verifies committed notes',async()=>{
  const {handler,req,res,calls}=server();await handler(req,res);assert.equal(res.statusCode,200);assert.equal(res.body.verified,true);
  assert.equal(calls[0].opts.headers.Authorization,'Bearer user-token');
  assert.deepEqual(JSON.parse(calls[0].opts.body),{p_ad_id:'v1',p_product_id:'A',p_original:'Original',p_notes:'New'});
  assert.ok(calls[1].url.includes('product_id=eq.A'));
});
test('API rejects unauthorized or invalid requests without database access',async()=>{
  for(const mode of ['token','body','method']){const {handler,req,res,calls}=server();
    if(mode==='token')req.headers={};if(mode==='body')req.body.notes={};if(mode==='method')req.method='GET';
    await handler(req,res);assert.ok(res.statusCode>=400);assert.equal(calls.length,0);
  }
});
test('API conflicts, permissions, missing records, failed readback do not report success',async()=>{
  for(const [code,status] of [['PT409',409],['40001',409],['42501',403],['P0002',404]]){
    const {handler,req,res,state,calls}=server();state.status=400;state.error={code};await handler(req,res);assert.equal(res.statusCode,status);assert.equal(calls.length,1);
  }
  const {handler,req,res,state}=server();state.readback='Different';await handler(req,res);assert.equal(res.statusCode,502);assert.equal(res.body.code,'VERIFY_FAILED');
});
