const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
const ts=require('typescript');

function load(file,dependencies,globals={}) {
  const module={exports:{}};
  const code=ts.transpileModule(readFileSync(`app/command-center/services/${file}.ts`,'utf8'),
    {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  runInNewContext(code,{module,exports:module.exports,...globals,require:id=>{
    if(id in dependencies)return dependencies[id];throw new Error(`Unexpected dependency ${id}`);
  }});
  return module.exports;
}
function fixture(options={}) {
  const calls=[];
  const worker={id:'private-worker',name:"Anay's Mac",enabled:true,classifier_available:true,heartbeat_at:new Date().toISOString()};
  const db={auth:{getSession:async()=>({data:{session:{access_token:'session-token',user:{id:'owner'}}}})},
    rpc:async name=>{assert.equal(name,'qa_private_workers_list');return {data:options.offline?[]:[worker]};}};
  const queue=load('queue-private-inspiration',{'./qa-clickup':{qaClickUpToken:()=>options.noKey?'':'test-token'}},{fetch:async(url,init)=>{
    calls.push({url,input:JSON.parse(init.body)});
    if(options.networkError)throw new Error('Network unavailable');
    return {ok:true,json:async()=>({id:'create-request',inspirationId:'INS-2',status:'pending',...options.receipt})};
  }});
  const saved={id:'INS-2',remoteAdIds:[],row:{},queue:{worker_assignment:'blocked:qa-isolation'}};
  const service=load('save-inspiration',{
    '../../../lib/services/inspiration-mutations.js':{mutateInspiration:async()=>{
      if(options.saveError)throw new Error('Save failed');return saved;
    }},
    './queue-private-inspiration':queue,
    './qa-clickup':{requestQaClickUp:()=>assert.fail('No task sync during intake')},
  });
  const request={p_product_id:'qa-product',p_request_id:'create-request',p_operation:'create',p_values:{mode:'url',fields:{}}};
  return {db,calls,queue,service,request};
}
test('Add to Queue saves and dispatches the acknowledged inspiration automatically',async()=>{
  const f=fixture();
  assert.equal(await f.service.saveInspiration(f.db,f.request),"Inspiration queued on Anay's Mac.");
  assert.equal(f.calls.length,1);
  assert.deepEqual(f.calls[0].input,{productId:'qa-product',inspirationId:'INS-2',requestId:'create-request',workerId:'private-worker'});
  await f.service.saveInspiration(f.db,f.request);
  assert.deepEqual(f.calls[1].input,f.calls[0].input,'Retry of the same save preserves dispatch identity');
});
test('intake acknowledges running and completed jobs without claiming they are pending',async()=>{
  for(const [status,notice] of [['running',"Inspiration is classifying on Anay's Mac."],['done','Inspiration already processed.']]) {
    const f=fixture({receipt:{status}});
    assert.equal(await f.service.saveInspiration(f.db,f.request),notice);
  }
});
test('dispatch failure preserves the saved inspiration and directs retry to that row',async()=>{
  for(const options of [{offline:true},{noKey:true},{networkError:true},{receipt:{inspirationId:'other'}},{receipt:{status:'failed'}}]) {
    const f=fixture(options),message=await f.service.saveInspiration(f.db,f.request);
    assert.match(message,/Inspiration saved\./);
    assert.match(message,/retry the existing inspiration/);
    assert.doesNotMatch(message,/Inspiration queued|Ready/);
    if(options.offline || options.noKey)assert.equal(f.calls.length,0);
  }
});
test('manual creation, ordinary edits and failed saves never trigger classification',async()=>{
  for(const change of [{p_values:{mode:'manual',fields:{}}},{p_operation:'save'}]) {
    const f=fixture();await f.service.saveInspiration(f.db,{...f.request,...change});assert.equal(f.calls.length,0);
  }
  const f=fixture({saveError:true});await assert.rejects(f.service.saveInspiration(f.db,f.request),/Save failed/);assert.equal(f.calls.length,0);
});
test('queue acknowledgements must identify the submitted or recovered job',async()=>{
  const f=fixture({receipt:{id:'wrong'}});
  await assert.rejects(f.queue.queuePrivateInspiration(f.db,{productId:'qa-product',inspirationId:'INS-2',requestId:'create-request'}),/acknowledgement/);
  const recovery=fixture({receipt:{id:'saved-job'}});
  await recovery.queue.queuePrivateInspiration(recovery.db,{productId:'qa-product',inspirationId:'INS-2',requestId:'retry-request',recoveryJobId:'saved-job'});
  assert.equal(recovery.calls[0].input.recoveryJobId,'saved-job');
});
test('table and activity do not relabel an undispatched private inspiration as Ready',()=>{
  for(const file of ['hooks/use-inspiration-library.ts','tabs/inspiration-tab.tsx']) {
    const source=readFileSync(`app/command-center/${file}`,'utf8');
    assert.doesNotMatch(source,/status:'ready'/);
    assert.match(source,/Not queued on your private worker/);
  }
});
