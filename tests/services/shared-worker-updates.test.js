import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { fork } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createReleaseUpdater, validateWorkerRelease, validateReleaseState, rejectRelease, readReleaseState,
  atomicJson, releaseDirectory, fetchApprovedRelease, stageWorkerRelease, QA_WORKER_MANIFEST, QA_WORKER_REPOSITORY } from '../../lib/services/shared-worker-updates.js';
import { superviseRelease, watchSupervisorConnection, waitForWorkerActivation } from '../../lib/services/shared-worker-supervisor.js';

const old='a'.repeat(40), next='b'.repeat(40);
const release={schema:1,environment:'qa',protocol:1,commit:next};
const state={schema:1,current:old,previous:null,pending:false,rejected:[]};

test('approved worker releases are QA-only pinned commits and a supported protocol',()=>{
  assert.deepEqual(validateWorkerRelease(release),release);
  for(const patch of [{environment:'production'},{protocol:2},{schema:2},{commit:'main'},{commit:'../escape'},{commit:'f'.repeat(41)}]) {
    assert.throws(()=>validateWorkerRelease({...release,...patch}));
  }
  assert.throws(()=>validateReleaseState({...state,current:'../../elsewhere'}));
  assert.throws(()=>validateReleaseState({...state,pending:true,previous:old}));
  assert.equal(releaseDirectory('/runtime','/bootstrap',null),'/bootstrap');
  assert.equal(releaseDirectory('/runtime','/bootstrap',next),`/runtime/releases/${next}`);
});

test('only the fixed approval manifest is fetched; no manifest means no deployment',async()=>{
  let called;
  assert.deepEqual(await fetchApprovedRelease(async(url,init)=>{called=url;assert.equal(init.redirect,'error');return Response.json(release);}),release);
  assert.equal(called,QA_WORKER_MANIFEST);
  assert.equal(await fetchApprovedRelease(async()=>new Response(null,{status:404})),null);
  await assert.rejects(fetchApprovedRelease(async()=>Response.json({...release,environment:'production'})));
  await assert.rejects(fetchApprovedRelease(async()=>new Response('x'.repeat(4097))));
});

test('candidate is staged before switching state; active and rejected versions are skipped',async()=>{
  for(const current of [state,{...state,current:next},{...state,rejected:[next]}]) {
    const calls=[];
    const update=createReleaseUpdater({readState:async()=>current,fetchRelease:async()=>release,
      stageRelease:async()=>calls.push('stage'),saveState:async(value)=>calls.push(value),now:()=>1000});
    const changed=await update();
    if(current.current===next || current.rejected.length) {assert.equal(changed,false);assert.deepEqual(calls,[]);}
    else {assert.equal(changed,true);assert.equal(calls[0],'stage');assert.deepEqual(calls[1],{...state,current:next,previous:old,pending:true});}
    assert.equal(await update(),false);
  }
});

test('network or staging failures retain the active release and back off',async()=>{
  let clock=1, attempts=0;
  const update=createReleaseUpdater({readState:async()=>state,fetchRelease:async()=>{attempts++;return release;},
    stageRelease:async()=>{throw new Error('fixture');},saveState:()=>assert.fail('must not activate'),now:()=>clock});
  assert.equal(await update(),false);clock=60001;assert.equal(await update(),false);assert.equal(attempts,1);
  clock=300002;assert.equal(await update(),false);assert.equal(attempts,2);
});

test('concurrent updater polls cannot stage two candidates',async()=>{
  let unblock, staged=0;
  const gate=new Promise(resolve=>{unblock=resolve;});
  const update=createReleaseUpdater({readState:async()=>state,fetchRelease:async()=>{await gate;return release;},
    stageRelease:async()=>{staged++;},saveState:async()=>{}});
  const first=update();assert.equal(await update(),false);unblock();assert.equal(await first,true);assert.equal(staged,1);
});

test('busy workers do not discover updates; shutdown during staging cannot activate a release',async()=>{
  let idle=false, fetched=0, staged=0, saved=0;
  const update=createReleaseUpdater({isIdle:()=>idle,readState:async()=>state,
    fetchRelease:async()=>{fetched++;return release;},stageRelease:async()=>{staged++;idle=false;},
    saveState:async()=>{saved++;}});
  assert.equal(await update(),false);
  assert.equal(fetched,0);
  idle=true;
  assert.equal(await update(),false);
  assert.equal(fetched,1);
  assert.equal(staged,1);
  assert.equal(saved,0);
});

test('pending startup is not overwritten and a save failure leaves the current pointer intact',async()=>{
  const pending=createReleaseUpdater({readState:async()=>({...state,current:next,previous:old,pending:true}),
    fetchRelease:()=>assert.fail('pending release must finish startup first')});
  assert.equal(await pending(),false);
  let stored=state;
  const update=createReleaseUpdater({readState:async()=>stored,fetchRelease:async()=>release,stageRelease:async()=>{},
    saveState:async()=>{throw new Error('disk unavailable');}});
  assert.equal(await update(),false);
  assert.equal(stored.current,old);
});

test('release state is atomic and invalid state fails closed',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'qa-release-test-'));
  try {
    assert.equal((await readReleaseState(directory)).current,null);
    await atomicJson(join(directory,'release-state.json'),state);
    assert.deepEqual(await readReleaseState(directory),state);
    await writeFile(join(directory,'release-state.json'),'invalid');
    await assert.rejects(readReleaseState(directory));
  } finally {await rm(directory,{recursive:true,force:true});}
});

test('staging pins repository and SHA, blocks runtime drift and disables package scripts',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'qa-staging-test-'));
  const bootstrap=join(directory,'bootstrap');
  await mkdir(join(bootstrap,'scripts'),{recursive:true});
  await writeFile(join(bootstrap,'scripts/shared-qa-requirements.txt'),'pinned');
  const calls=[];
  const run=async(command,args,options)=>{
    calls.push({command,args,env:options.env});
    if(command==='git' && args.includes('checkout')) {
      await mkdir(join(options.cwd,'scripts'),{recursive:true});
      await mkdir(join(options.cwd,'worker-releases'),{recursive:true});
      await writeFile(join(options.cwd,'scripts/shared-qa-requirements.txt'),'pinned');
      await writeFile(join(options.cwd,'worker-releases/contract.json'),JSON.stringify({schema:1,environment:'qa',protocol:1,entry:'scripts/private-worker.mjs'}));
    }
    return {stdout:args.includes('rev-parse')?next+'\n':''};
  };
  try {
    const target=await stageWorkerRelease({release,directory,bootstrapRoot:bootstrap,pythonBin:'/isolated/python',run});
    assert.equal(JSON.parse(await readFile(join(target,'.release-ready.json'),'utf8')).commit,next);
    assert(calls.some(call=>call.args.includes(QA_WORKER_REPOSITORY)&&call.args.includes(next)));
    assert(calls.some(call=>call.command==='npm'&&call.args.includes('--ignore-scripts')));
    assert(calls.every(call=>!('QA_SUPABASE_SERVICE_ROLE_KEY' in call.env)&&!('GIT_CONFIG_COUNT' in call.env)));
    const before=calls.length;await stageWorkerRelease({release,directory,bootstrapRoot:bootstrap,pythonBin:'/isolated/python',run});
    assert.equal(calls.length,before);
    await writeFile(join(bootstrap,'scripts/shared-qa-requirements.txt'),'different');
    await assert.rejects(stageWorkerRelease({release,directory,bootstrapRoot:bootstrap,pythonBin:'/isolated/python',run}),/runtime upgrade/);
    const other={...release,commit:'c'.repeat(40)};
    await assert.rejects(stageWorkerRelease({release:other,directory,bootstrapRoot:bootstrap,pythonBin:'/isolated/python',run:async(command,args,options)=>{
      const result=await run(command,args,options);return args.includes('rev-parse')?{stdout:other.commit}:result;
    }}),/runtime upgrade/);
  } finally {await rm(directory,{recursive:true,force:true});}
});

test('failed release verification never leaves an installable candidate',async()=>{
  for(const failure of ['commit','protocol','npm','node-test','python-test']) {
    const directory=await mkdtemp(join(tmpdir(),'qa-rejected-staging-'));
    const bootstrap=join(directory,'bootstrap');
    await mkdir(join(bootstrap,'scripts'),{recursive:true});
    await writeFile(join(bootstrap,'scripts/shared-qa-requirements.txt'),'pinned');
    const run=async(command,args,options)=>{
      if(command==='git' && args.includes('checkout')) {
        await mkdir(join(options.cwd,'scripts'),{recursive:true});
        await mkdir(join(options.cwd,'worker-releases'),{recursive:true});
        await writeFile(join(options.cwd,'scripts/shared-qa-requirements.txt'),'pinned');
        await writeFile(join(options.cwd,'worker-releases/contract.json'),JSON.stringify({schema:1,
          environment:failure==='protocol'?'production':'qa',protocol:1,entry:'scripts/private-worker.mjs'}));
      }
      if((failure==='npm' && command==='npm') || (failure==='node-test' && args.includes('--test'))
        || (failure==='python-test' && command==='/isolated/python')) throw new Error('verification failed');
      return {stdout:args.includes('rev-parse')?(failure==='commit'?old:next):''};
    };
    try {
      await assert.rejects(stageWorkerRelease({release,directory,bootstrapRoot:bootstrap,pythonBin:'/isolated/python',run}));
      assert.deepEqual(await readdir(join(directory,'releases')),[]);
      assert.equal((await readReleaseState(directory)).current,null);
    } finally {await rm(directory,{recursive:true,force:true});}
  }
});

class Child extends EventEmitter {
  messages=[];
  send(value,callback) {this.messages.push(value);callback();setImmediate(()=>this.emit('exit',75));}
  kill(signal) {this.emit('exit',signal==='SIGKILL'?137:143);}
}

test('supervisor confirms a healthy candidate before allowing queue claims',async()=>{
  const child=new Child(),saved=[];
  const promise=superviseRelease({child,state:{...state,current:next,previous:old,pending:true},saveState:async value=>{
    assert.equal(child.messages.length,0);saved.push(value);
  }});
  child.emit('message',{type:'qa-worker-ready',protocol:1,classifier:true});
  assert.deepEqual(await promise,{code:75,rollback:false});
  assert.equal(saved[0].pending,false);
  assert.equal(child.messages[0].type,'qa-worker-activate');
});

test('startup crash, bad capability and timeout roll back without activation',async()=>{
  for(const failure of ['crash','capability','timeout']) {
    const child=new Child(),saved=[];
    const promise=superviseRelease({child,state:{...state,current:next,previous:old,pending:true},saveState:async value=>saved.push(value),startupTimeoutMs:10});
    if(failure==='crash') child.emit('exit',1);
    if(failure==='capability') child.emit('message',{type:'qa-worker-ready',protocol:1,classifier:false});
    assert.deepEqual(await promise,{code:75,rollback:true});
    assert.deepEqual(saved[0],{...state,rejected:[next]});
    assert.equal(child.messages.length,0);
  }
});

test('rollback can return to the original bootstrap without a previous managed release',()=>{
  assert.deepEqual(rejectRelease({...state,current:next,previous:null,pending:true}),{schema:1,current:null,previous:null,pending:false,rejected:[next]});
});

test('real child process waits for activation; startup failure never receives permission to work',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'qa-supervisor-process-'));
  const script=join(directory,'worker.mjs');
  await writeFile(script,`if(process.argv[2]==='crash')process.exit(1);
process.on('message',message=>{if(message.type==='qa-worker-activate'){process.send({type:'claimed-fixture'});process.disconnect();}});
process.send({type:'qa-worker-ready',protocol:1,classifier:true});\n`);
  try {
    for(const mode of ['ready','crash']) {
      const child=fork(script,[mode],{stdio:['ignore','ignore','ignore','ipc']});
      let confirmed=false,claimed=false;
      child.on('message',message=>{if(message.type==='claimed-fixture'){assert.equal(confirmed,true);claimed=true;}});
      const result=await superviseRelease({child,state:{...state,current:next,previous:old,pending:true},
        saveState:async value=>{confirmed=value.current===next&&!value.pending;},startupTimeoutMs:5000});
      assert.equal(result.rollback,mode==='crash');assert.equal(claimed,mode==='ready');
    }
  } finally {await rm(directory,{recursive:true,force:true});}
});

test('stopping during startup does not blacklist a valid candidate',async()=>{
  const child=new Child(),stop=new AbortController();
  const result=superviseRelease({child,state:{...state,current:next,previous:old,pending:true},signal:stop.signal,
    saveState:()=>assert.fail('shutdown must not approve or reject a release')});
  stop.abort();
  assert.deepEqual(await result,{code:1,rollback:false});
  assert.equal(child.messages.length,0);
});

test('worker activation handles cancellation, IPC errors and mismatched protocol without claiming',async()=>{
  for(const mode of ['cancelled','disconnected','send-error','disconnect','activate']) {
    const worker=new EventEmitter(),abort=new AbortController();
    worker.connected=mode!=='disconnected';
    const messages=[];
    worker.send=(message,callback)=>{messages.push(message);callback(mode==='send-error'?new Error('closed'):null);};
    if(mode==='cancelled')abort.abort();
    const waiting=waitForWorkerActivation(worker,{classifier:true,signal:abort.signal});
    if(mode==='activate') {
      worker.emit('message',{type:'qa-worker-activate',protocol:2});
      assert.equal(worker.listenerCount('message'),1);
      worker.emit('message',{type:'qa-worker-activate',protocol:1});
      await waiting;
    } else {
      if(mode==='disconnect')worker.emit('disconnect');
      await assert.rejects(waiting);
    }
    assert.equal(worker.listenerCount('message'),0);
    assert.equal(worker.listenerCount('disconnect'),0);
    assert.equal(messages.length,['cancelled','disconnected'].includes(mode)?0:1);
  }
});

test('an already orphaned worker stops immediately',()=>{
  const worker=new EventEmitter();worker.connected=false;
  let stopped=false;
  const cleanup=watchSupervisorConnection(worker,()=>{stopped=true;});
  assert.equal(stopped,true);
  cleanup();assert.equal(worker.listenerCount('disconnect'),0);
});

test('real managed worker aborts when its launcher disconnects after activation',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'qa-orphan-process-'));
  const script=join(directory,'worker.mjs');
  const helper=new URL('../../lib/services/shared-worker-supervisor.js',import.meta.url).href;
  await writeFile(script,`import {watchSupervisorConnection,waitForWorkerActivation} from ${JSON.stringify(helper)};
const abort=new AbortController();
const timer=setInterval(()=>{},1000);
watchSupervisorConnection(process,()=>{abort.abort();clearInterval(timer);});
await waitForWorkerActivation(process,{classifier:true,signal:abort.signal});
process.send({type:'active-fixture'});\n`);
  const child=fork(script,[],{stdio:['ignore','ignore','ignore','ipc']});
  let active=false;
  const exit=new Promise((resolve,reject)=>{
    child.once('exit',resolve);child.once('error',reject);
  });
  const timeout=setTimeout(()=>child.kill('SIGKILL'),5000);
  try {
    child.on('message',message=>{
      if(message.type==='qa-worker-ready')child.send({type:'qa-worker-activate',protocol:1});
      if(message.type==='active-fixture'){active=true;child.disconnect();}
    });
    assert.equal(await exit,0);
    assert.equal(active,true);
  } finally {
    clearTimeout(timeout);
    await rm(directory,{recursive:true,force:true});
  }
});
