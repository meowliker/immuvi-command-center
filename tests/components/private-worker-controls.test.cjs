const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');

function render(workers){
  let index=0;
  const module={exports:{}};
  const source=ts.transpileModule(readFileSync('app/command-center/components/private-worker-controls.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText;
  runInNewContext(source,{module,exports:module.exports,Date,require:id=>{
    if(id==='react')return {...React,useEffect(){},useState(value){return [index++===0?workers:value,()=>{}];}};
    if(id.endsWith('.css'))return {default:new Proxy({},{get:(_,key)=>key})};
    return require(id);
  }});
  return renderToStaticMarkup(module.exports.PrivateWorkerControls({db:{}}));
}
test('private worker panel is compact and separates agent readiness from image generation',()=>{
  const html=render([{id:'a',name:"Anay's Mac",enabled:true,heartbeat_at:new Date().toISOString(),generation_available:false,codex_active:true,claude_active:false}]);
  assert.match(html,/Anay&#x27;s Mac/);assert.match(html,/Online/);assert.match(html,/Codex: Active/);assert.match(html,/Claude: Inactive/);
  assert.doesNotMatch(html,/CONTRACT|CAPABILITIES|qa-sample-offline|Shared workers|<dl/);
});
test('stale and paused workers never advertise active agents',()=>{
  for(const worker of [{enabled:true,heartbeat_at:'2020-01-01'},{enabled:false,heartbeat_at:new Date().toISOString()}]){
    const html=render([{id:'a',name:'Mac',codex_active:true,claude_active:true,...worker}]);
    assert.match(html,/Codex: Inactive/);assert.match(html,/Claude: Inactive/);
  }
});
