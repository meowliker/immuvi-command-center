import { access } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { fork } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { managedUpdatesEnabled, readReleaseState, releaseDirectory, atomicJson } from '../lib/services/shared-worker-updates.js';
import { superviseRelease } from '../lib/services/shared-worker-supervisor.js';
process.umask(0o077);
const path=process.argv[2];
if(!path)throw new Error('Shared QA configuration path required.');
console.log('Shared QA launcher started; awaiting local pairing if needed.');
for(;;){try{await access(path);break;}catch{await sleep(10000);}}
const directory=dirname(path),bootstrapRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if (!await managedUpdatesEnabled(directory) && !(await readReleaseState(directory)).current) {
  await import('./private-worker.mjs');
} else {
  const stop=new AbortController();
  process.on('SIGTERM',()=>stop.abort());process.on('SIGINT',()=>stop.abort());
  while (!stop.signal.aborted) {
    const state=await readReleaseState(directory);
    const root=releaseDirectory(directory,bootstrapRoot,state.current);
    const child=fork(join(root,'scripts/private-worker.mjs'),[path],{
      cwd:root,stdio:['ignore','inherit','inherit','ipc'],
      env:{...process.env,IMMUVI_MANAGED_QA_WORKER:'1',IMMUVI_QA_BOOTSTRAP_ROOT:bootstrapRoot},
    });
    const result=await superviseRelease({child,state,signal:stop.signal,
      saveState:value=>atomicJson(join(directory,'release-state.json'),value)});
    if (result.rollback) console.error('Candidate QA release failed startup; returning to the previous worker.');
    if (result.code!==75) {process.exitCode=stop.signal.aborted?0:1;break;}
  }
}
