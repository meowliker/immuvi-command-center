import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

for (const file of ['immuvi-command-center.html','public/immuvi-command-center.html']) {
  const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  function load(context,start,end) {
    const a=html.indexOf(start),b=html.indexOf(end,a);
    assert.ok(a>0&&b>a);
    vm.runInContext(html.slice(a,b),context);
  }
  test(file+': checkbox is labeled, adjacent to URL, and off by default',()=>{
    assert.match(html,/<input type="checkbox" id="insNoBrief" \/>No Brief<\/label>/);
    assert.ok(html.indexOf('id="insNoBrief"')>html.indexOf('id="insUrlInput"'));
    assert.ok(html.indexOf('id="insNoBrief"')<html.indexOf('id="insAddBtn"'));
  });
  test(file+': each new inspiration captures its own checkbox value',()=>{
    const input={value:'https://example.com/one'},box={checked:true};
    const c=vm.createContext({document:{getElementById:id=>({insUrlInput:input,insNoBrief:box})[id]},
      INSPIRATIONS:[],INS_NEXT_ID:1,getProductInsPrefix:()=> 'Q',detectPlatform:()=> 'instagram',
      getCurrentInspirationAddedBy:()=> 'tester',saveInspirations(){},renderInspirations(){},
      updateQueueCounter(){},showInsStatus(){},autoPushToBridge(){}});
    load(c,'function addToInsQueue()','async function autoPushToBridge()');
    c.addToInsQueue();
    box.checked=false;input.value='https://example.com/two';c.addToInsQueue();
    assert.equal(c.INSPIRATIONS[0].noBrief,false);
    assert.equal(c.INSPIRATIONS[1].noBrief,true);
    input.value='https://example.com/one';c.addToInsQueue();
    assert.equal(c.INSPIRATIONS.length,2);
  });
  test(file+': auto queue and Process All retain mixed per-item modes',async()=>{
    const items=[{id:'a',sourceUrl:'https://a',noBrief:true},{id:'b',sourceUrl:'https://b',noBrief:false},{id:'legacy',sourceUrl:'https://c'}];
    const payloads=[];
    const c=vm.createContext({getQueuedItems:()=>items,activeProductId:'p',console,
      DB:{ready:true,getResults:async()=>[],enqueueInspirations:async(_,rows)=>{payloads.push(rows);return {ok:true};}},
      showInsStatus(){},showProcessModal(){}});
    load(c,'async function autoPushToBridge()','function getQueuedItems()');
    load(c,'async function processAllWithClaude()','function showProcessModal(');
    await c.autoPushToBridge();await c.processAllWithClaude();
    for(const rows of payloads) assert.deepEqual(Array.from(rows,r=>r.noBrief),[true,false,false]);
  });
  test(file+': DB persists strict no_brief boolean without consulting current checkbox',async()=>{
    let queued;
    const query={select(){return this;},gte(){return this;},neq(){return this;},
      then(resolve){return Promise.resolve({data:[{enabled:true,capabilities:{claude:true}}]}).then(resolve);},
      async upsert(rows){queued=rows;return {error:null};}};
    const c=vm.createContext({SB:{from:()=>query},window:{},console,
      _insWorkerIsLive:()=>true,_insWorkerHasClassifierContract:()=>true,_insWorkerIsHealthyClassifier:()=>true});
    const a=html.indexOf('  async enqueueInspirations('),b=html.indexOf('\n  },',a);
    vm.runInContext('globalThis.enqueue='+html.slice(a,b+4).trim().replace('async enqueueInspirations','async function'),c);
    await c.enqueue('product',[{id:'a',url:'https://a',noBrief:true},{id:'b',url:'https://b',noBrief:'true'},{id:'c',url:'https://c'}]);
    assert.deepEqual(Array.from(queued,row=>row.no_brief),[true,false,false]);
    assert.ok(queued.every(row=>row.product_id==='product'));
  });
  test(file+': inline scripts still parse',()=>{
    for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc\s*=|type\s*=\s*["'](?:module|application\/ld\+json)/i.test(match[1])) continue;
      new vm.Script(match[2],{filename:file});
    }
    assert.match(html,/ins\.noBrief === true \|\| !!ins\._clickupDocPageUrl/);
  });
}
