const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');

async function fixture(name,props,queue=async()=>({status:'pending'})) {
  const domain=await import('../../lib/domain/private-inspiration-queue.js');
  const states=[],refs=[];let stateIndex=0,refIndex=0;
  const module={exports:{}};
  const code=ts.transpileModule(readFileSync(`app/command-center/components/${name}.tsx`,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText;
  runInNewContext(code,{module,exports:module.exports,Error,crypto:{randomUUID:()=> 'request-one'},require:id=>{
    if(id==='react')return {...React,useState:initial=>{const index=stateIndex++;if(!(index in states))states[index]=initial;return [states[index],value=>{states[index]=value;}];},useRef:initial=>{const index=refIndex++;return refs[index]||=( {current:initial} );}};
    if(id.endsWith('queue-private-inspiration'))return {queuePrivateInspiration:queue};
    if(id.endsWith('private-inspiration-queue.js'))return domain;
    return require(id);
  }});
  const component=Object.values(module.exports)[0];
  return {render(){stateIndex=0;refIndex=0;return component(props);}};
}
const nodes=tree=>!tree || typeof tree!=='object'?[]:[tree,...React.Children.toArray(tree.props?.children).flatMap(nodes)];
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('retry dispatches only selected task, recovers saved brief, and locks double clicks',async()=>{
  let finish;const calls=[],messages=[];
  const f=await fixture('private-inspiration-retry',{db:{rpc:async()=>({data:[{id:'saved',inspiration_id:'one',worker_id:'mac',has_result:true,can_retry_delivery:true,status:'failed'}]})},productId:'qa',inspirationId:'one',done:m=>messages.push(m)},async(db,input)=>{calls.push(input);await new Promise(resolve=>{finish=resolve;});});
  const button=nodes(f.render()).find(node=>node.type==='button');
  button.props.onClick();button.props.onClick();await flush();
  assert.equal(calls.length,1);assert.equal(calls[0].inspirationId,'one');assert.equal(calls[0].recoveryJobId,'saved');assert.equal(calls[0].workerId,'mac');
  assert.match(renderToStaticMarkup(f.render()),/disabled.*Queuing/s);
  finish();await flush();assert.equal(messages[0],'Saved brief requeued for delivery.');
});
test('retry keeps errors in the message box and reuses request identity after uncertain response',async()=>{
  const calls=[];
  const f=await fixture('private-inspiration-retry',{db:{rpc:async()=>({data:[]})},productId:'qa',inspirationId:'one',done:()=>assert.fail('Not successful')},async(db,input)=>{calls.push(input);throw new Error('Network unavailable');});
  nodes(f.render()).find(n=>n.type==='button').props.onClick();await flush();
  assert.match(renderToStaticMarkup(f.render()),/role="alert">Network unavailable/);
  nodes(f.render()).find(n=>n.type==='button').props.onClick();await flush();
  assert.equal(calls.length,2);assert.equal(calls[0].requestId,calls[1].requestId);
});
test('unsafe delivery receipts never dispatch another generation',async()=>{
  const f=await fixture('private-inspiration-retry',{db:{rpc:async()=>({data:[{inspiration_id:'one',has_result:true,status:'failed',can_retry_delivery:false}]})},productId:'qa',inspirationId:'one',done:()=>{}},()=>assert.fail('Unsafe dispatch'));
  nodes(f.render()).find(n=>n.type==='button').props.onClick();await flush();
  assert.match(renderToStaticMarkup(f.render()),/needs delivery review/);
});
test('priority icons submit the chosen job and direction, then refresh',async()=>{
  const calls=[];let refreshed=0;
  const f=await fixture('inspiration-priority',{db:{rpc:async(name,input)=>{calls.push({name,input});return {}; }},jobId:'queued',refresh:()=>refreshed++});
  for(const label of ['Run next','Move up','Move down']){nodes(f.render()).find(n=>n.props['aria-label']===label).props.onClick();await flush();}
  assert.deepEqual(calls.map(c=>c.input.p_direction),['top','up','down']);
  assert.ok(calls.every(c=>c.name==='qa_private_inspiration_move'&&c.input.p_id==='queued'));assert.equal(refreshed,3);
});
test('priority failure is visible and does not pretend the move succeeded',async()=>{
  const f=await fixture('inspiration-priority',{db:{rpc:async()=>({error:{message:'Task already started'}})},jobId:'queued',refresh:()=>assert.fail('Move failed')});
  nodes(f.render()).find(n=>n.props['aria-label']==='Run next').props.onClick();await flush();
  assert.match(renderToStaticMarkup(f.render()),/role="alert">Task already started/);
});
test('cancel submits only the selected job, locks duplicate clicks and refreshes after acknowledgement',async()=>{
  let finish;const calls=[];let refreshed=0;
  const f=await fixture('inspiration-cancel',{db:{rpc:async(name,input)=>{calls.push({name,input});await new Promise(resolve=>{finish=resolve;});return {};}},jobId:'selected',refresh:()=>refreshed++});
  const button=nodes(f.render()).find(n=>n.type==='button');button.props.onClick();button.props.onClick();
  assert.equal(calls.length,1);assert.equal(calls[0].name,'qa_private_inspiration_cancel');assert.equal(calls[0].input.p_id,'selected');
  assert.equal(refreshed,0);finish();await flush();assert.equal(refreshed,1);
});
test('cancel failure remains visible and does not report success',async()=>{
  const f=await fixture('inspiration-cancel',{db:{rpc:async()=>({error:{message:'Access denied'}})},jobId:'selected',refresh:()=>assert.fail('not cancelled')});
  nodes(f.render()).find(n=>n.type==='button').props.onClick();await flush();
  assert.match(renderToStaticMarkup(f.render()),/role="alert">Access denied/);
});
