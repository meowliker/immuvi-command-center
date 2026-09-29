import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import { recoverInspiration, recoveryFailure, recoveryDirectory, createRecoveryLeaseGuard } from '../../lib/services/shared-inspiration-recovery.js';
import { classifyExtractedInspiration } from '../../scripts/private-inspiration-runner.mjs';

async function fixture(t) {
  const directory=await mkdtemp(join(tmpdir(),'qa-recovery-test-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const frame=join(directory,'frame.png');await writeFile(frame,'fixture');
  const job={id:'20000000-0000-4000-8000-000000000001',worker_id:'worker',product_id:'qa',inspiration_id:'one',
    source_url:'https://example.test/ad',source_version:'v1',context:{product:'qa'},sealed_clickup_token:'never-save-this'};
  const calls=[],abort=new AbortController();
  const input={job,directory,signal:abort.signal,checkpoint:async(stage)=>{calls.push(stage);job.generation_started=true;},
    extract:async()=>{calls.push('extract');return {frames:[frame]};},generate:async()=>{calls.push('generate');return {markdown:'saved'};},
    validate:value=>{assert.ok(value.markdown);return value;}};
  return {input,calls,abort,job,directory};
}
test('source and generated output survive restart without download or regeneration',async t=>{
  const {input,calls,directory}=await fixture(t);
  assert.deepEqual(await recoverInspiration(input),{markdown:'saved'});
  assert.deepEqual(calls,['extract','generation-start','generate']);
  assert.deepEqual(await recoverInspiration(input),{markdown:'saved'});
  assert.equal(calls.length,3);
  for(const file of ['source-checkpoint.json','validated-result.json'])assert.doesNotMatch(await readFile(join(directory,file),'utf8'),/never-save-this|sealed_clickup_token/);
});
test('known database result needs neither local media nor generation',async t=>{
  const {input,calls}=await fixture(t);input.job.result={markdown:'from database'};
  assert.deepEqual(await recoverInspiration(input),input.job.result);assert.deepEqual(calls,[]);
});
test('crash after CLI output but before DB checkpoint recovers the completed raw result',async t=>{
  const {input,calls,directory}=await fixture(t);
  input.generate=async()=>{await writeFile(join(directory,'result.json'),'```json\n{"markdown":"raw saved"}\n```');throw new Error('simulated process exit');};
  await assert.rejects(recoverInspiration(input),/process exit/);
  assert.deepEqual(await recoverInspiration(input),{markdown:'raw saved'});
  assert.deepEqual(calls,['extract','generation-start']);
});
test('crash during generation with no output never silently generates again',async t=>{
  const {input,calls}=await fixture(t);
  input.generate=async()=>{calls.push('generate');throw new Error('crash');};
  await assert.rejects(recoverInspiration(input),/crash/);
  await assert.rejects(recoverInspiration(input),error=>error.code==='GENERATION_OUTCOME_UNCERTAIN');
  assert.equal(calls.filter(c=>c==='generate').length,1);
});
test('lost generation-start acknowledgment does not execute generation and is not blindly retried',async t=>{
  const {input,calls}=await fixture(t);
  input.checkpoint=async()=>{input.job.generation_started=true;throw new Error('ack lost');};
  await assert.rejects(recoverInspiration(input),/ack lost/);
  await assert.rejects(recoverInspiration(input),error=>error.code==='GENERATION_OUTCOME_UNCERTAIN');
  assert.deepEqual(calls,['extract']);
});
test('shutdown after output retains the result, and cancellation before start performs no work',async t=>{
  const {input,abort,calls}=await fixture(t);
  input.generate=async()=>{abort.abort();return {markdown:'finished before shutdown'};};
  await assert.rejects(recoverInspiration(input));
  const count=calls.length;
  await assert.rejects(recoverInspiration(input));assert.equal(calls.length,count);
  input.signal=new AbortController().signal;
  assert.deepEqual(await recoverInspiration(input),{markdown:'finished before shutdown'});
});
test('changed source identity and corrupt checkpoints fail closed',async t=>{
  const {input,directory}=await fixture(t);await recoverInspiration(input);
  input.job.source_version='changed';
  await assert.rejects(recoverInspiration(input),error=>error.code==='RECOVERY_CHECKPOINT_INVALID');
  await writeFile(join(directory,'source-checkpoint.json'),'partial JSON');
  await assert.rejects(recoverInspiration(input),SyntaxError);
  assert.throws(()=>recoveryDirectory('/runtime',{id:'../../escape'}));
});
test('automatic retry is limited to interruptions and transient failures, not auth or content errors',()=>{
  for(const status of [408,429,500,502,503,504])assert.equal(recoveryFailure({status}).retry,true);
  for(const status of [400,401,403,404,422])assert.equal(recoveryFailure({status}).retry,false);
  assert.equal(recoveryFailure(new TypeError('fetch failed')).retry,true);
  assert.equal(recoveryFailure({code:'NETWORK_UNAVAILABLE'}).retry,true);
  assert.equal(recoveryFailure(new Error('invalid result')).retry,false);
  const abort=new AbortController();abort.abort();assert.deepEqual(recoveryFailure(new Error('shutdown'),abort.signal),{retry:true,reason:'interrupted'});
});
test('network outage and sleep/wake abort locally before the server lease can be reused',()=>{
  let now=0;const abort=new AbortController();const guard=createRecoveryLeaseGuard(abort,()=>now);
  now=60000;assert.equal(guard.check(),true);guard.renew(now);
  now=149999;assert.equal(guard.check(),true);
  now=150000;assert.equal(guard.check(),false);
  guard.renew(now);assert.equal(guard.check(),false,'a late heartbeat must not revive an aborted lease');
});
test('cancelling generation forcibly stops a CLI that ignores graceful termination',async t=>{
  const {directory,abort,job}=await fixture(t);
  const executable=join(directory,'fixture-cli');
  await writeFile(executable,'#!/usr/bin/env node\n'+
    "const fs=require('node:fs');process.on('SIGTERM',()=>{});fs.writeFileSync('started','yes');setInterval(()=>{},1000);\n",{mode:0o700});
  let finished=false;
  const execution=classifyExtractedInspiration({scope:'shared',codexBin:executable},job,{frames:[]},directory,abort.signal)
    .then(()=>{finished=true;return null;},error=>{finished=true;return error;});
  let started=false;
  try {
    for(let n=0;n<100 && !finished;n++) {
      started=await readFile(join(directory,'started'),'utf8').then(()=>true,()=>false);
      if(started)break;
      await sleep(20);
    }
    assert.equal(started,true,'fixture CLI started');
  } finally {abort.abort();}
  const error=await execution;
  assert.match(error.message,/classifier failed/);
});
