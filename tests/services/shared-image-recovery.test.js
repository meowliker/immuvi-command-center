import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,readFile,rm,stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import sharp from 'sharp';
import { recoverSharedImages,generationName,assertSharedImageJob,imageHash } from '../../lib/services/shared-image-recovery.js';
import { createSharedImageDelivery } from '../../lib/services/shared-image-delivery.js';
import { validateGeneratedImages } from '../../lib/services/qa-image-generation.js';
import { legacyProducerCreativeContract,runNativeCodex } from '../../scripts/qa-native-image-runner.mjs';

const manifest={status:'done',outputs:[{variation:1,filename:'1.png',prompt:'fixture only',reference_anatomy:'fixture',quality_checks:['fixture'],passed:true,native_tool:'image_gen__imagegen'}]};
async function fixture(t,count=2) {
 const directory=await mkdtemp(join(tmpdir(),'producer-recovery-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const run={id:'30000000-0000-4000-8000-000000000001',private_worker_id:'worker',product_id:'qa-sample-astrorekha',status:'running',lease_id:'lease',
  request:{options:{count}},delivery:{protocol:1,list_id:'1301130000002447',task_id:'qa-task',sealed_token:'never-persist',started:[],outputs:[]}};
 const stored=new Map(),events=[];
 const input={run,directory,signal:new AbortController().signal,
  checkpoint:async(stage,value)=>{events.push(stage);if(stage==='output')run.delivery.outputs.push(value);},
  prepare:async()=>({taskName:'Task / Name',referenceFiles:[]}),
  generate:async({variation,directory:dir})=>{events.push(`generate-${variation}`);
   const bytes=await sharp({create:{width:512,height:512,channels:3,background:variation===1?'#2495ac':'#f263a1'}}).png().toBuffer();
   await writeFile(join(dir,'1.png'),bytes);await writeFile(join(dir,'result.json'),JSON.stringify(manifest));return manifest;},
  storage:{download:async path=>stored.has(path)?{data:new Blob([stored.get(path)])}:{error:{statusCode:'404'}},
   upload:async(path,bytes)=>{stored.set(path,bytes);events.push('upload');return{};}},
  deliver:async(_image,n)=>{events.push(`deliver-${n}`);return{url:`https://fixture.test/${n}`,id:String(n)};}};
 return {input,events,stored,run,directory};
}
test('shared Producer uses exact legacy creative instructions and safe final names',async()=>{
 const legacy=await readFile('team-skill/immuvi-creative-producer/SKILL.md','utf8');
 assert.equal(await legacyProducerCreativeContract(),legacy.slice(legacy.indexOf('\n3. Extract the creative brief.'),legacy.indexOf('\n6. Upload and update systems.')));
 assert.equal(generationName('Task / Name',2),'Task - Name-2.png');assert.throws(()=>generationName('../',0));
 assert.throws(()=>assertSharedImageJob({scope:'private'},{status:'running'}));
});
test('sequential accepted variations resume without generation or storage duplicates',async t=>{
 const {input,events,stored,directory}=await fixture(t);
 const result=await recoverSharedImages(input);
 assert.deepEqual(result.outputs.map(o=>o.filename),['Task - Name-1.png','Task - Name-2.png']);
 assert.ok(events.indexOf('deliver-1')<events.indexOf('generate-2'));
 await recoverSharedImages(input);
 assert.equal(events.filter(e=>e.startsWith('generate')).length,2);assert.equal(stored.size,2);
 assert.doesNotMatch(await readFile(join(directory,'producer-context.json'),'utf8'),/never-persist/);
});
test('completed raw output survives a crash before validation and database save',async t=>{
 const {input,events}=await fixture(t,1),generate=input.generate;
 input.generate=async args=>{await generate(args);throw new Error('process died');};
 await assert.rejects(recoverSharedImages(input),/process died/);
 await recoverSharedImages(input);
 assert.equal(events.filter(e=>e==='generate-1').length,1);
});
test('saved image_gen output recovers after legacy validation rejection without regeneration',async t=>{
 const {input,events,stored,directory}=await fixture(t,1),generate=input.generate;
 const alias={...manifest,outputs:[{...manifest.outputs[0],native_tool:'image_gen'}]};
 input.generate=async args=>{
  await generate(args);
  await writeFile(join(args.directory,'result.json'),JSON.stringify(alias));
  return alias;
 };
 const legacyValidate=async(dir,value,count)=>{
  if(!value.outputs[0].native_tool.includes('imagegen'))throw new Error('Image quality manifest is invalid.');
  return validateGeneratedImages(dir,value,count);
 };
 await assert.rejects(recoverSharedImages({...input,validate:legacyValidate}),/manifest is invalid/);
 assert.deepEqual(input.run.delivery.started,[1]);assert.equal(stored.size,0);
 const local=join(directory,'variation-1');
 await assert.rejects(stat(join(local,'accepted.json')),{code:'ENOENT'});
 const preserved=await Promise.all(['result.json','1.png'].map(async name=>({name,hash:imageHash(await readFile(join(local,name))),mtime:(await stat(join(local,name))).mtimeMs})));
 input.generate=async()=>assert.fail('Saved output must never regenerate');
 const result=await recoverSharedImages(input);
 assert.equal(result.outputs[0].native_tool,'image_gen');
 assert.equal(result.outputs[0].sha256,preserved[1].hash);
 assert.deepEqual(JSON.parse(await readFile(join(local,'accepted.json'),'utf8')),alias);
 await recoverSharedImages(input);
 assert.equal(events.filter(e=>e==='generate-1').length,1);
 assert.equal(events.filter(e=>e==='upload').length,1);assert.equal(stored.size,1);
 for(const saved of preserved) {
  assert.equal(imageHash(await readFile(join(local,saved.name))),saved.hash);
  assert.equal((await stat(join(local,saved.name))).mtimeMs,saved.mtime);
 }
});
test('uncertain paid generation is never repeated, including a lost start acknowledgment',async t=>{
 const {input}=await fixture(t,1);let calls=0;
 input.checkpoint=async(stage,value)=>{if(stage==='generation-start'){input.run.delivery.started.push(value.variation);throw new Error('ack lost');}};
 input.generate=async()=>{calls++;return manifest;};
 await assert.rejects(recoverSharedImages(input),/ack lost/);
 await assert.rejects(recoverSharedImages(input),e=>e.code==='IMAGE_OUTCOME_UNCERTAIN');assert.equal(calls,0);
});
test('partial storage and a lost upload response recover without overwriting bytes',async t=>{
 const {input,stored,events}=await fixture(t,1);
 input.storage.upload=async(path,bytes)=>{stored.set(path,bytes);events.push('upload');return{error:{message:'lost response'}};};
 await recoverSharedImages(input);assert.equal(events.filter(e=>e==='upload').length,1);
 stored.set([...stored.keys()][0],Buffer.from('changed'));
 await assert.rejects(recoverSharedImages(input),/checksum changed/);
});
test('failed delivery retains the accepted variation and resumes it before generating the next',async t=>{
 const {input,events}=await fixture(t);const deliver=input.deliver;let once=true;
 input.deliver=async(...args)=>{if(once){once=false;throw new Error('network');}return deliver(...args);};
 await assert.rejects(recoverSharedImages(input),/network/);await recoverSharedImages(input);
 assert.equal(events.filter(e=>e==='generate-1').length,1);assert.equal(events.filter(e=>e==='generate-2').length,1);
});
test('changed job identity and corrupt source checkpoint fail closed',async t=>{
 const {input,directory}=await fixture(t,1);await recoverSharedImages(input);
 input.run.request.options.count=2;
 await assert.rejects(recoverSharedImages(input),/context changed/);
 await writeFile(join(directory,'producer-context.json'),'{');
 await assert.rejects(recoverSharedImages(input),SyntaxError);
});

function clickupFixture() {
 const run={id:'qa-run',product_id:'qa-sample-astrorekha',delivery:{task_id:'qa-task',list_id:'1301130000002447',intents:{},receipts:{}},request:{options:{},creative:{}}};
 const bytes=Buffer.from('fixture-image-bytes'),image={bytes,metadata:{variation:1,filename:'Task-1.png',sha256:imageHash(bytes)}};
 let attachments=[],comments=[],status='in production',lostAttachment=false,lostComment=false,moved=false;
 const calls=[];
 const response=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
 const fetchImpl=async(url,init={})=>{
  const path=new URL(url).pathname,method=init.method || 'GET';calls.push(`${method} ${path}`);
  assert.equal(new URL(url).hostname,'api.clickup.com');
  if(path.endsWith('/attachment')&&method==='POST') {
   assert.ok(init.body instanceof FormData);assert.equal(init.headers['Content-Type'],undefined);
   const a={id:'attachment',title:'Task-1.png',url:'https://fixture.test/image'};attachments.push(a);
   if(lostAttachment)throw new TypeError('fetch failed');return response(a);
  }
  if(path.endsWith('/comment')) {
   if(method==='GET')return response({comments});
   const c={id:'comment',comment_text:JSON.parse(init.body).comment_text};comments.push(c);
   if(lostComment)throw new TypeError('fetch failed');return response(c);
  }
  if(path.endsWith('/task/qa-task')) {
   if(method==='PUT')status=JSON.parse(init.body).status;
   return response({id:'qa-task',name:'Task',list:{id:moved?'production':'1301130000002447'},status:{status},attachments});
  }
  throw new Error(`Unexpected ${path}`);
 };
 const checkpoints=[];
 const make=()=>createSharedImageDelivery({run,token:'fixture-token',signal:new AbortController().signal,checkpoint:async(s,v)=>checkpoints.push([s,v]),download:async()=>bytes,fetchImpl});
 return {run,image,calls,checkpoints,make,loseAttachment:()=>lostAttachment=true,loseComment:()=>lostComment=true,move:()=>moved=true,
  removeAttachment:()=>attachments=[],getStatus:()=>status};
}
test('ClickUp delivery reads back every image and summary before advancing status',async()=>{
 const f=clickupFixture(),delivery=f.make(),receipt=await delivery.deliver(f.image,1);
 await delivery.finish([{...f.image.metadata,...receipt}]);
 assert.equal(f.getStatus(),'Ready to Launch');assert.equal(f.checkpoints.at(-1)[0],'complete');
 assert.equal(f.calls.filter(c=>c.startsWith('POST')).length,2);
 await delivery.finish([{...f.image.metadata,...receipt}]);
 assert.equal(f.calls.filter(c=>c.startsWith('POST')).length,2);
});
test('lost attachment create response is reconciled by new ID, name and byte hash without another POST',async()=>{
 const f=clickupFixture();f.loseAttachment();
 await assert.rejects(f.make().deliver(f.image,1),/fetch failed/);
 const receipt=await f.make().deliver(f.image,1);assert.equal(receipt.id,'attachment');
 assert.equal(f.calls.filter(c=>c.includes('/attachment')&&c.startsWith('POST')).length,1);
});
test('uncertain absent attachment stops for review instead of a duplicate upload',async()=>{
 const f=clickupFixture();f.loseAttachment();await assert.rejects(f.make().deliver(f.image,1));f.removeAttachment();
 await assert.rejects(f.make().deliver(f.image,1),e=>e.code==='IMAGE_OUTCOME_UNCERTAIN');
 assert.equal(f.calls.filter(c=>c.includes('/attachment')&&c.startsWith('POST')).length,1);
});
test('lost summary response reuses the marked comment and does not create another',async()=>{
 const f=clickupFixture(),receipt=await f.make().deliver(f.image,1),outputs=[{...f.image.metadata,...receipt}];
 f.loseComment();await assert.rejects(f.make().finish(outputs),/fetch failed/);
 await f.make().finish(outputs);
 assert.equal(f.calls.filter(c=>c.includes('/comment')&&c.startsWith('POST')).length,1);
});
test('a moved task prevents any upload or status write',async()=>{
 const f=clickupFixture();f.move();await assert.rejects(f.make().deliver(f.image,1),/does not belong/);
 assert.equal(f.calls.some(c=>c.startsWith('POST')||c.startsWith('PUT')),false);
});
test('Producer cancellation forcibly stops a native CLI that ignores SIGTERM',async t=>{
 const {directory}=await fixture(t,1),executable=join(directory,'fixture-cli'),abort=new AbortController();
 await writeFile(executable,'#!/usr/bin/env node\n'+"const fs=require('node:fs');process.on('SIGTERM',()=>{});fs.writeFileSync('started','yes');setInterval(()=>{},1000);\n",{mode:0o700});
 const previous=process.env.IMMUVI_CODEX_BIN;process.env.IMMUVI_CODEX_BIN=executable;
 t.after(()=>{if(previous===undefined)delete process.env.IMMUVI_CODEX_BIN;else process.env.IMMUVI_CODEX_BIN=previous;});
 const operation=runNativeCodex(directory,'fixture',join(directory,'result.json'),[],20000,abort.signal).then(()=>null,error=>error);
 for(let n=0;n<100;n++) {if(await readFile(join(directory,'started')).then(()=>true,()=>false))break;await sleep(20);}
 const started=Date.now();abort.abort();const result=await operation;
 assert.ok(result instanceof Error);assert.ok(Date.now()-started<8000);
});
