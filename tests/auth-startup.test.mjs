import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

for (const file of ['immuvi-command-center.html','public/immuvi-command-center.html']) {
  const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  function setup() {
    const calls={logout:0,login:[],hidden:0,filtered:0};
    const state={session:{user:{id:'user'},access_token:'token'},profile:{id:'user',role:'member',is_active:true},profileError:null,productsError:null};
    const c=vm.createContext({console,AUTH:{},_withCloudTimeout:async p=>p,
      SB:{auth:{getSession:async()=>({data:{session:state.session}}),signOut:async()=>calls.logout++},realtime:{setAuth(){}},
        from(table){const q={select(){return q;},eq(){return q;},single(){return q;},update(){return q;},
          then(resolve,reject){return Promise.resolve(table==='profiles'?{data:state.profile,error:state.profileError}:{data:[{product_id:'allowed'}],error:state.productsError}).then(resolve,reject);}};return q;}},
      _showLogin:message=>calls.login.push(message),_hideLogin:()=>calls.hidden++,
      _renderUserPill(){},_toggleAdminTabVisibility(){},_patchDBForUser:()=>calls.filtered++,
      document:{addEventListener(){},getElementById:()=>({classList:{remove(){},add(){}}})}
    });
    const start=html.indexOf('async function _onSession(');
    const end=html.indexOf('/* ─── Admin tab',start);
    vm.runInContext(html.slice(start,end),c);
    return {c,calls,state};
  }
  test(file+': signed-out startup stops before loading products',async()=>{
    const {c,calls,state}=setup();state.session=null;
    assert.ok(!await c._startAuthInit());assert.equal(calls.login.length,1);assert.equal(calls.filtered,0);
    const start=html.indexOf("window.addEventListener('load', async function () {");
    const boot=html.slice(start,start+500);
    assert.ok(boot.indexOf('await _startAuthInit()')<boot.indexOf('_syncHeaderHeightVar()'));
    assert.ok(boot.includes('if (!authenticated) return;'));
  });
  test(file+': auth init is single-flight and filters products before boot continues',async()=>{
    const {c,calls}=setup();const p=c._startAuthInit();assert.equal(c._startAuthInit(),p);
    assert.equal(await p,true);assert.equal(calls.filtered,1);assert.equal(calls.hidden,1);
    assert.deepEqual(Array.from(c.AUTH.productIds),['allowed']);
  });
  test(file+': transient profile or access-list failures do not destroy session',async()=>{
    for(const key of ['profileError','productsError']){
      const {c,calls,state}=setup();state[key]={message:'Network failed'};
      assert.equal(await c._startAuthInit(),false);assert.equal(calls.logout,0);assert.equal(calls.hidden,0);
      assert.match(calls.login[0],/Could not reach/);
    }
  });
  test(file+': deactivated account and password-change gate do not start dashboard',async()=>{
    const first=setup();first.state.profile.is_active=false;assert.ok(!await first.c._startAuthInit());assert.equal(first.calls.logout,1);
    const second=setup();second.state.profile.must_change_password=true;assert.ok(!await second.c._startAuthInit());assert.equal(second.calls.hidden,0);
  });
  test(file+': cloud error cannot make sign-in inert',()=>{
    const c=vm.createContext({_cloudLoadFailed:false,_adsProductId:'A',document:{body:{classList:{remove(){}},children:[]},
      getElementById:id=>id==='loginOverlay'?{classList:{contains:()=>true}}:null,
      createElement(){throw Error('Must not overlay sign-in');}}});
    const a=html.indexOf('function _showCloudLoadFailure()'),b=html.indexOf('function _shouldRenderTab(',a);
    vm.runInContext(html.slice(a,b),c);c._showCloudLoadFailure();assert.equal(c._cloudLoadFailed,true);
    assert.equal(c._adsProductId,null);
  });
  test(file+': cached unauthorized product cannot be speculatively fetched',()=>{
    const a=html.indexOf('async function loadState()'),b=html.indexOf('var _productsP',a);
    assert.ok(html.slice(a,b).includes('!AUTH.hasProduct(_savedActiveId)'));
  });
  test(file+': inline JavaScript parses',()=>{
    for(const [,attrs,body]of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!/type="module"|src=/.test(attrs))new vm.Script(body);
  });
}
