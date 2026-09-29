import { readFile, mkdir, realpath } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { atomicJson } from './shared-worker-updates.js';

function failure(code, message) { return Object.assign(new Error(message), {code}); }
export function createRecoveryLeaseGuard(abort, now=Date.now) {
  // Database leases last 120s; stop earlier even if every heartbeat request fails.
  let deadline=now()+90000;
  return {
    renew(startedAt) { if (!abort.signal.aborted) deadline=startedAt+90000; },
    check() { if (now()>=deadline) abort.abort(); return !abort.signal.aborted; },
  };
}
function identity(job) {
  return createHash('sha256').update(JSON.stringify([job.id,job.worker_id,job.product_id,
    job.inspiration_id,job.source_url,job.source_version,job.context])).digest('hex');
}
export function recoveryDirectory(root, job) {
  if (!/^[a-f0-9-]{36}$/i.test(job.id || '')) throw new Error('Invalid recovery job identity.');
  return join(root,'jobs',job.id);
}
async function readJson(path) {
  try { return JSON.parse(await readFile(path,'utf8')); }
  catch (error) { if (error.code==='ENOENT') return null; throw error; }
}

// No API keys or encrypted credentials are written into the local checkpoint.
export async function recoverInspiration({job,directory,signal,checkpoint,extract,generate,validate}) {
  signal.throwIfAborted();
  if (job.result) return job.result;
  await mkdir(directory,{recursive:true,mode:0o700});
  const key=identity(job), saved=await readJson(join(directory,'source-checkpoint.json'));
  if (saved && saved.identity!==key) throw failure('RECOVERY_CHECKPOINT_INVALID','Saved source identity changed. Review retained evidence before retrying.');
  let media=saved?.media;
  if (job.generation_started && !media) throw failure('GENERATION_OUTCOME_UNCERTAIN','Generation was interrupted without a recoverable source checkpoint. Review retained output; automatic regeneration was not attempted.');
  if (!media) {
    media=await extract();
    signal.throwIfAborted();
    await atomicJson(join(directory,'source-checkpoint.json'),{identity:key,media});
  }
  const root=await realpath(directory);
  if (!Array.isArray(media.frames) || !media.frames.length) throw failure('RECOVERY_CHECKPOINT_INVALID','Saved media checkpoint is incomplete.');
  for (const frame of media.frames) {
    if (!(await realpath(frame)).startsWith(root+sep)) throw failure('RECOVERY_CHECKPOINT_INVALID','Saved media is outside this job directory.');
  }
  const result=await readJson(join(directory,'validated-result.json'));
  if (result) {
    if (result.identity!==key) throw failure('RECOVERY_CHECKPOINT_INVALID','Saved result identity changed.');
    return validate(result.value,media);
  }
  if (job.generation_started) {
    // Recover the CLI's completed last message if the process died before DB save.
    let raw;
    try { raw=(await readFile(join(directory,'result.json'),'utf8')).trim().replace(/^```json\s*/,'').replace(/\s*```$/,''); }
    catch(error) { if(error.code!=='ENOENT')throw error; }
    if (!raw) throw failure('GENERATION_OUTCOME_UNCERTAIN','Generation was interrupted and no completed result was saved. Review retained output; automatic regeneration was not attempted.');
    const value=validate(JSON.parse(raw),media);
    await atomicJson(join(directory,'validated-result.json'),{identity:key,value});
    return value;
  }
  signal.throwIfAborted();
  await checkpoint('generation-start');
  signal.throwIfAborted();
  const value=await generate(media);
  // Save completed output even if shutdown arrives immediately after generation.
  await atomicJson(join(directory,'validated-result.json'),{identity:key,value});
  signal.throwIfAborted();
  return value;
}

export function recoveryFailure(error, signal) {
  if (signal?.aborted) return {retry:true,reason:'interrupted'};
  if ([408,429,500,502,503,504].includes(error?.status)) return {retry:true,reason:error.status===429?'rate_limit':'provider_unavailable'};
  if (['NETWORK_UNAVAILABLE','ECONNRESET','ETIMEDOUT','EAI_AGAIN','ENOTFOUND'].includes(error?.code)
    || ['AbortError','TimeoutError'].includes(error?.name)
    || (error instanceof TypeError && error.message==='fetch failed')) return {retry:true,reason:'network'};
  return {retry:false};
}
