import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';
for(const file of ['immuvi-command-center.html','public/immuvi-command-center.html']) {
  const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  function context() {
    const c=vm.createContext({console,crypto:{randomUUID},activeProductId:'A',_inspirationsProductId:'A',
      _uiProductGeneration:1,_cloudLoadFailed:false,_productSwitchPending:false,DB:{ready:true},
      showInsStatus(){},_withCloudTimeout:x=>x,SB:{}});
    const a=html.indexOf('var _insAddBusy = false;'),b=html.indexOf('var INS_POLL_TIMER',a);
    vm.runInContext(html.slice(a,b),c);return c;
  }
  test(file+': all creation paths use server allocation, never a local count',()=>{
    assert.doesNotMatch(html, /id:\s*(?:getProductInsPrefix\(\) \+ '-INS-'|'INS-') \+ String\(INS_NEXT_ID\)/);
    assert.equal((html.match(/await _persistNewInspiration\(/g)||[]).length,5);
    assert.match(html,/if \(data.source_url && ins.sourceUrl && data.source_url !== ins.sourceUrl\) return;/);
  });
  test(file+': source identity and revision are restored from authoritative columns',()=>{
    const c=context(),r=c._inspirationFromRow({id:'A-INS-141',product_id:'A',url:'https://a',status:'Classified',updated_at:'v1',data:{sourceUrl:'https://wrong',product_id:'B',status:'Testing'}});
    assert.equal(r.product_id,'A');assert.equal(r.sourceUrl,'https://a');assert.equal(r.status,'Classified');
    assert.equal(r._persistedSignature,c._inspirationSignature(r));
    r._baseUpdatedAt='v2';assert.equal(r._persistedSignature,c._inspirationSignature(r));
    r.angle='new';assert.notEqual(r._persistedSignature,c._inspirationSignature(r));
  });
  test(file+': server failure does not allocate a local ID or mutate inspiration',async()=>{
    const c=context(),ins={sourceUrl:'https://a',status:'Queued'};
    c.console={error(){}};c.SB.rpc=async()=>({error:Error('offline')});
    assert.equal(await c._persistNewInspiration(ins,'A'),false);assert.equal(ins.id,undefined);
  });
  test(file+': switching product during creation cannot append to the new product',async()=>{
    const c=context();let resolve;c.SB.rpc=()=>new Promise(r=>resolve=r);
    const ins={sourceUrl:'https://a',status:'Queued'};const pending=c._persistNewInspiration(ins,'A');
    c.activeProductId='B';c._uiProductGeneration++;
    resolve({data:{id:'A-INS-141',product_id:'A',url:'https://a',status:'Queued',updated_at:'v1',data:{}}});
    assert.equal(await pending,false);assert.equal(ins.product_id,'A');
  });
  test(file+': saved snapshots are revision-checked and only changed records are written',async()=>{
    const c=context();let sent=[];
    c.SB.from=()=>({upsert(rows){sent=rows;return {select:async()=>({data:rows.map(r=>({...r,updated_at:'v2'}))})};}});
    const a=html.indexOf('  async saveInspirations('),b=html.indexOf('  // Replaces bridge POST /queue',a);
    vm.runInContext('DB = {'+html.slice(a,b)+'}; INSPIRATIONS=[];',c);
    const row=c._inspirationFromRow({id:'a',product_id:'A',url:'https://a',status:'Saved',updated_at:'v1',data:{}});
    await c.DB.saveInspirations('A',[row]);assert.equal(sent.length,0);
    row.angle='beginner';await c.DB.saveInspirations('A',[row]);assert.equal(sent.length,1);
    assert.equal(sent[0].data._baseUpdatedAt,'v1');assert.equal(row._baseUpdatedAt,'v2');
    sent=[];await c.DB.saveInspirations('B',[row]);assert.equal(sent.length,0);
  });
}
