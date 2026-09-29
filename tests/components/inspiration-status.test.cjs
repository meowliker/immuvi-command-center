const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');

function fixture(status,error,children) {
  let hidden=0;
  const module={exports:{}};
  const source=ts.transpileModule(readFileSync('app/command-center/components/inspiration-status.tsx','utf8'),
    {compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText;
  runInNewContext(source,{module,exports:module.exports,require:id=>{
    if(id==='react')return {...React,useId:()=> 'error-popover'};
    if(id.endsWith('.css'))return {default:new Proxy({},{get:(_,key)=>key})};
    if(id.endsWith('use-anchored-popover'))return {useAnchoredPopover:()=>({trigger:{current:null},panel:{current:{hidePopover(){hidden++;}}}})};
    return require(id);
  }});
  return {tree:module.exports.InspirationStatus({id:'QAA-INS-001',status,error,children}),get hidden(){return hidden;}};
}
const nodes=tree=>!tree || typeof tree!=='object'?[]:[tree,...React.Children.toArray(tree.props?.children).flatMap(nodes)];
test('failure details open from a badge in a small non-modal popover, not a tooltip',()=>{
  const f=fixture('Failed','Transcript timestamps exceeded audio duration.');
  const all=nodes(f.tree),trigger=all.find(n=>n.props.popoverTarget),panel=all.find(n=>n.props.popover);
  assert.equal(trigger.props.children,'Failed');assert.equal(trigger.props.title,undefined);
  assert.equal(trigger.props.popoverTarget,panel.props.id);assert.equal(panel.props.popover,'auto');
  assert.equal(panel.props['aria-modal'],undefined);
  assert.match(renderToStaticMarkup(panel),/Transcript timestamps exceeded/);
  assert.doesNotMatch(renderToStaticMarkup(trigger),/Transcript/);
  all.find(n=>n.props['aria-label']==='Close processing error').props.onClick();assert.equal(f.hidden,1);
});
test('normal status has no error popup and unavailable failure details have a fallback',()=>{
  assert.doesNotMatch(renderToStaticMarkup(fixture('Classified','Old error').tree),/popover|Old error/);
  assert.match(renderToStaticMarkup(fixture('Failed','').tree),/No error details were recorded/);
});
test('failed and blocked badges contain retry controls only inside the message box',()=>{
  for(const status of ['Failed','Blocked']) {
    const tree=fixture(status,'Error',React.createElement('button',null,'Requeue')).tree;
    const panel=nodes(tree).find(n=>n.props.popover);
    assert.match(renderToStaticMarkup(panel),/>Requeue</);
    assert.doesNotMatch(renderToStaticMarkup(nodes(tree).find(n=>n.props.popoverTarget)),/Requeue/);
  }
});
test('format-name cell no longer contains failure details or a second source URL',()=>{
  const source=readFileSync('app/command-center/components/inspiration-library.tsx','utf8');
  const held=source.split("if(key==='formatName' && held)")[1].split('\n')[0];
  assert.doesNotMatch(held,/queueError|sourceUrl/);
  assert.match(source,/InspirationStatus id=\{row.id\} status=\{row.status\} error=\{row.queueError\}/);
});
test('Inspiration notices use the shared side notifications without an inline status banner',()=>{
  const source=readFileSync('app/command-center/tabs/inspiration-tab.tsx','utf8');
  assert.match(source,/useWorkspaceNotice\(\{message:notice,title:'Inspiration'/);
  assert.doesNotMatch(source,/className=\{styles\.notice\}/);
  assert.match(source,/setNotice\(''\)/);
});
