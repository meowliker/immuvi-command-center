import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../immuvi-command-center.html',import.meta.url),'utf8');
const code=source.slice(source.indexOf('async function deleteInspiration(id) {'),source.indexOf('\nfunction useInspirationFormat(id)'));
async function run({personal=true,cancelError=false,deleteError=false}={}){
  const calls=[],messages=[];let saves=0;
  const ctx={INSPIRATIONS:[{id:'SAME',product_id:'selected'},{id:'SAME',product_id:'other'}],activeProductId:'selected',
    window:{_personalWorkerCancel:async(pid,id)=>{calls.push({op:'cancel',pid,id});if(cancelError)throw Error('Wrong ClickUp owner');}},
    renderInspirations(){calls.push({op:'render'});},saveInspirations(){saves++;},toast(text){messages.push(text);},
    SB:{from(table){const query={table,filters:[],op:'select'};const builder={
      select(){return builder;},delete(){query.op='delete';return builder;},
      eq(key,value){query.filters.push([key,value]);return builder;},
      async maybeSingle(){calls.push(query);return {data:personal?{worker_assignment:'private'}:{worker_assignment:'auto'}};},
      then(resolve,reject){calls.push(query);return Promise.resolve({error:deleteError&&table==='inspirations'?{message:'fixture'}:null}).then(resolve,reject);}
    };return builder;}}};
  vm.createContext(ctx);vm.runInContext(code,ctx);await ctx.deleteInspiration('SAME');return {ctx,calls,messages,saves};
}
test('private deletion cancels before deleting and scopes every operation to the selected product',async()=>{
  const {ctx,calls,saves}=await run();
  assert.ok(calls.findIndex(c=>c.op==='cancel')<calls.findIndex(c=>c.op==='delete'));
  for(const call of calls.filter(c=>c.table))assert.ok(call.filters.some(([key,value])=>key==='product_id'&&value==='selected'));
  assert.equal(ctx.INSPIRATIONS.length,1);assert.equal(ctx.INSPIRATIONS[0].product_id,'other');assert.equal(saves,0);
});
test('cancellation or deletion denial keeps the inspiration visible and cannot resurrect rows through a bulk save',async()=>{
  for(const options of [{cancelError:true},{deleteError:true}]){
    const {ctx,calls,messages,saves}=await run(options);
    assert.equal(ctx.INSPIRATIONS.length,2);assert.equal(saves,0);assert.equal(messages.length,1);
    assert.equal(calls.filter(c=>c.op==='render').length,0);
  }
});
test('shared deletion does not require a personal worker or ClickUp cancellation',async()=>{
  const {calls}=await run({personal:false});assert.equal(calls.filter(c=>c.op==='cancel').length,0);
});
