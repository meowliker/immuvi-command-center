import test from 'node:test';
import assert from 'node:assert/strict';
import {personalWorkerChoiceKey,readPersonalWorkerChoice,savePersonalWorkerChoice,isPersonalWorkerChoice} from '../public/personal-worker-preference.mjs';

const a='personal:11111111-1111-4111-8111-111111111111',b='personal:22222222-2222-4222-8222-222222222222';
function storage(){const values=new Map();return {values,getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};}
async function withStorage(run){
  const previous=['localStorage','sessionStorage'].map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]);
  const local=storage(),session=storage();
  Object.defineProperty(globalThis,'localStorage',{value:local,configurable:true});
  Object.defineProperty(globalThis,'sessionStorage',{value:session,configurable:true});
  try{await run(local,session);}finally{for(const [name,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
}
test('preference scope is deterministic, opaque and separated by both identities',async()=>{
  const identity='shared-account|fixture-personal-key';
  const key=await personalWorkerChoiceKey(identity);
  assert.match(key,/^immuvi\.personalWorker\.choice\.v2\.[a-f0-9]{64}$/);
  assert.equal(await personalWorkerChoiceKey(identity),key);
  assert.notEqual(await personalWorkerChoiceKey('shared-account|another-key'),key);
  assert.notEqual(await personalWorkerChoiceKey('another-account|fixture-personal-key'),key);
  assert.equal(await personalWorkerChoiceKey(''),'');
  assert.ok(!key.includes('fixture-personal-key')&&!key.includes('shared-account'));
});
test('browser persistence stores only scoped device selections, not credentials',async()=>withStorage(async(local,session)=>{
  const ka=await personalWorkerChoiceKey('shared|key-a'),kb=await personalWorkerChoiceKey('shared|key-b');
  assert.equal(savePersonalWorkerChoice(ka,a),true);savePersonalWorkerChoice(kb,b);
  assert.equal(readPersonalWorkerChoice(ka),a);assert.equal(readPersonalWorkerChoice(kb),b);
  session.values.clear();assert.equal(readPersonalWorkerChoice(ka),a);
  assert.deepEqual([...local.values.values()],[a,b]);
  assert.ok(!JSON.stringify([...local.values]).includes('key-a'));
}));
test('choosing Auto clears only that identity and leaves other colleagues untouched',async()=>withStorage(async(local,session)=>{
  const ka=await personalWorkerChoiceKey('shared|key-a'),kb=await personalWorkerChoiceKey('shared|key-b');
  savePersonalWorkerChoice(ka,a);savePersonalWorkerChoice(kb,b);savePersonalWorkerChoice(ka,'');
  assert.equal(readPersonalWorkerChoice(ka),'');assert.equal(readPersonalWorkerChoice(kb),b);
  assert.ok(!local.values.has(ka)&&!session.values.has(ka));
}));
test('blocked local storage falls back to session storage without throwing',async()=>withStorage(async(local)=>{
  const key=await personalWorkerChoiceKey('shared|key-a');
  local.setItem=()=>{throw new Error('Storage blocked');};local.getItem=()=>{throw new Error('Storage blocked');};
  assert.equal(savePersonalWorkerChoice(key,a),false);assert.equal(readPersonalWorkerChoice(key),a);
}));
test('unscoped legacy or malformed selections are never adopted',async()=>withStorage(async(local,session)=>{
  const key=await personalWorkerChoiceKey('shared|key-a');
  session.setItem('immuvi.personalWorker.choice',a);
  local.setItem(key,'personal:invalid');
  assert.equal(readPersonalWorkerChoice(key),'');assert.equal(readPersonalWorkerChoice('immuvi.personalWorker.choice'),'');
  assert.equal(savePersonalWorkerChoice('raw-secret',a),false);
  assert.equal(savePersonalWorkerChoice(key,'personal:invalid'),false);
  assert.equal(isPersonalWorkerChoice('auto'),false);assert.equal(isPersonalWorkerChoice(a),true);
}));
test('browser storage access denied does not crash selection restoration',async()=>withStorage(async()=>{
  const key=await personalWorkerChoiceKey('shared|key-a');
  for(const name of ['localStorage','sessionStorage'])Object.defineProperty(globalThis,name,{get(){throw new Error('Access denied');},configurable:true});
  assert.equal(readPersonalWorkerChoice(key),'');assert.equal(savePersonalWorkerChoice(key,a),false);
}));
