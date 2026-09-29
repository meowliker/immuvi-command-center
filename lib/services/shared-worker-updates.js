import { mkdir, readFile, writeFile, rename, mkdtemp, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const exec = promisify(execFile);
export const QA_WORKER_REPOSITORY = 'https://github.com/meowliker/immuvi-command-center.git';
export const QA_WORKER_MANIFEST = 'https://raw.githubusercontent.com/meowliker/immuvi-command-center/qa/worker-releases/qa.json';
export const QA_WORKER_PROTOCOL = 1;
const shaPattern = /^[a-f0-9]{40}$/;

export function validateWorkerRelease(value) {
  if (!value || value.schema !== 1 || value.environment !== 'qa' || value.protocol !== QA_WORKER_PROTOCOL
    || !shaPattern.test(value.commit || '')) throw new Error('Unsupported QA worker release.');
  return { schema:1, environment:'qa', protocol:QA_WORKER_PROTOCOL, commit:value.commit };
}

export function validateReleaseState(value) {
  if (!value || value.schema !== 1 || ![true,false].includes(value.pending)
    || ![value.current,value.previous].every(commit=>commit === null || shaPattern.test(commit || ''))
    || !Array.isArray(value.rejected) || value.rejected.length > 20 || !value.rejected.every(commit=>shaPattern.test(commit))
    || (value.pending && (!value.current || value.current === value.previous))) throw new Error('Invalid QA release state.');
  return value;
}

export async function atomicJson(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});
  try { await rename(temporary,path); }
  finally { await rm(temporary,{force:true}); }
}

export async function readReleaseState(directory) {
  try { return validateReleaseState(JSON.parse(await readFile(join(directory,'release-state.json'),'utf8'))); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return {schema:1,current:null,previous:null,pending:false,rejected:[]};
  }
}

export function releaseDirectory(directory, bootstrapRoot, commit) {
  if (commit === null) return bootstrapRoot;
  if (!shaPattern.test(commit || '')) throw new Error('Invalid release commit.');
  return join(directory,'releases',commit);
}

export function rejectRelease(state) {
  validateReleaseState(state);
  if (!state.pending) throw new Error('No candidate release to reject.');
  return {schema:1,current:state.previous,previous:null,pending:false,rejected:[...new Set([...state.rejected,state.current])].slice(-20)};
}

export async function fetchApprovedRelease(fetchImpl = fetch) {
  const response = await fetchImpl(QA_WORKER_MANIFEST,{redirect:'error',signal:AbortSignal.timeout(10000),cache:'no-store'});
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Approved QA release unavailable.');
  const body = await response.text();
  if (body.length > 4096) throw new Error('Invalid release manifest size.');
  return validateWorkerRelease(JSON.parse(body));
}

export function createReleaseUpdater({readState,saveState,fetchRelease,stageRelease,now=Date.now,onError=()=>{}}) {
  let nextCheck = 0, checking = false;
  return async function check() {
    if (checking || now() < nextCheck) return false;
    checking = true;
    nextCheck = now() + 60000;
    try {
      const state = validateReleaseState(await readState());
      if (state.pending) return false;
      const candidate = await fetchRelease();
      if (!candidate) return false;
      const {commit} = validateWorkerRelease(candidate);
      if (commit === state.current || state.rejected.includes(commit)) return false;
      await stageRelease(candidate);
      await saveState({schema:1,current:commit,previous:state.current,pending:true,rejected:state.rejected});
      return true;
    } catch { nextCheck=now()+300000;onError('QA update check failed; keeping the current worker.');return false; }
    finally { checking = false; }
  };
}

// Staging never reads the device secret or runs repository package lifecycle hooks.
export async function stageWorkerRelease({release,directory,bootstrapRoot,pythonBin,signal,run=exec}) {
  const {commit} = validateWorkerRelease(release);
  const releases = join(directory,'releases');
  await mkdir(releases,{recursive:true,mode:0o700});
  const destination = releaseDirectory(directory,bootstrapRoot,commit);
  try {
    const receipt = validateWorkerRelease(JSON.parse(await readFile(join(destination,'.release-ready.json'),'utf8')));
    if (receipt.commit !== commit) throw new Error('Release receipt mismatch.');
    return destination;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const staging = await mkdtemp(join(releases,'.staging-'));
  const env = {PATH:process.env.PATH,HOME:process.env.HOME,GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',
    npm_config_ignore_scripts:'true',npm_config_audit:'false',npm_config_fund:'false',PYTHONNOUSERSITE:'1',PYTHONDONTWRITEBYTECODE:'1'};
  const options = {cwd:staging,env,signal,timeout:120000,maxBuffer:2_000_000};
  try {
    await run('git',['init','--quiet'],options);
    await run('git',['-c','core.hooksPath=/dev/null','fetch','--quiet','--depth=1',QA_WORKER_REPOSITORY,commit],options);
    await run('git',['-c','core.hooksPath=/dev/null','checkout','--quiet','--detach','FETCH_HEAD'],options);
    const head = await run('git',['rev-parse','HEAD'],options);
    if (head.stdout.trim() !== commit) throw new Error('Release commit mismatch.');
    const contract = JSON.parse(await readFile(join(staging,'worker-releases/contract.json'),'utf8'));
    if (contract.schema !== 1 || contract.environment !== 'qa' || contract.protocol !== QA_WORKER_PROTOCOL
      || contract.entry !== 'scripts/private-worker.mjs') throw new Error('Incompatible worker protocol.');
    const hash = value=>createHash('sha256').update(value).digest('hex');
    const dependencyFile = 'scripts/shared-qa-requirements.txt';
    if (hash(await readFile(join(staging,dependencyFile))) !== hash(await readFile(join(bootstrapRoot,dependencyFile)))) {
      throw new Error('Python runtime upgrade requires a separately verified installation.');
    }
    await run('npm',['ci','--ignore-scripts','--no-audit','--no-fund'],options);
    await run(process.execPath,['--check','scripts/private-worker.mjs'],options);
    await run(process.execPath,['--test','tests/services/shared-worker.test.js','tests/services/private-inspiration.test.js','tests/services/shared-worker-updates.test.js'],options);
    await run(pythonBin,['-m','unittest','discover','-s','tests','-p','test_facebook_snapshot.py'],options);
    await atomicJson(join(staging,'.release-ready.json'),release);
    await rename(staging,destination);
    return destination;
  } finally { await rm(staging,{recursive:true,force:true}); }
}

export async function managedUpdatesEnabled(directory) {
  try {
    const value = JSON.parse(await readFile(join(directory,'updates.json'),'utf8'));
    return value.schema === 1 && value.enabled === true;
  } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
