import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { atomicJson } from './shared-worker-updates.js';
import { workerDestination, SHARED_QA_PRODUCT } from './shared-worker.js';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}

export function assertAnalysisJob(config, job) {
  workerDestination(job.product_id,job.context,{library:true});
  if (config.scope !== 'shared' || job.worker_id !== config.id
    || !/^[a-f0-9-]{36}$/.test(job.id || '') || !job.lease_id || job.status !== 'running'
    || !['variation','strategist'].includes(job.kind)) throw new Error('Analysis job is outside shared QA.');
}

// Each generated unit has its own start fence and immutable result. An expired
// lease is not permission to repeat a model call with an unknown outcome.
export async function recoverAnalysisUnit({job, key, input, directory, checkpoint, generate, validate, signal, replaySafe=false,
  decodeRaw=text=>JSON.parse(text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''))}) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(key)) throw new Error('Invalid analysis unit.');
  const identity = createHash('sha256').update(JSON.stringify(canonical([job.id, job.product_id, job.worker_id,
    job.kind, job.parent_ad_id, job.target_ad_id, job.drive_file_id, job.context, input]))).digest('hex');
  // Old Astro checkpoints remain recoverable only inside their original fixed
  // destination. Kids never accepts the older, less-specific hash namespace.
  let legacyIdentity;
  if(job.product_id===SHARED_QA_PRODUCT) {
    workerDestination(job.product_id,job.context,{library:true});
    legacyIdentity=createHash('sha256').update(JSON.stringify(canonical([job.id,job.kind,job.context,input]))).digest('hex');
  }
  const matchesIdentity=value=>value===identity || (legacyIdentity!==undefined && value===legacyIdentity);
  const root = join(directory, key);
  await mkdir(root, {recursive:true, mode:0o700});
  const saved = job.units?.[key];
  if (saved) {
    if (!matchesIdentity(saved.identity)) throw new Error('Analysis input changed; saved output requires review.');
    return validate(saved.value);
  }
  let disk;
  try { disk = JSON.parse(await readFile(join(root,'accepted.json'),'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  let value;
  if (disk) {
    if (!matchesIdentity(disk.identity)) throw new Error('Saved analysis identity changed.');
    value = validate(disk.value);
  } else if (job.started?.includes(key) && !replaySafe) {
    if (!matchesIdentity(job.intents?.[key])) throw new Error('Started analysis input changed; review required.');
    let raw;
    try {
      let text;
      try {text=await readFile(join(root,'result.json'),'utf8');}
      catch(error){if(error.code!=='ENOENT')throw error;text=await readFile(join(root,'last-message.txt'),'utf8');}
      raw=decodeRaw(text);
    }
    catch { throw new Error('Generation was interrupted without a completed result. Review retained output before starting another run.'); }
    value = validate(raw);
  } else {
    signal.throwIfAborted();
    if (!job.started?.includes(key)) {
      await checkpoint('start', {key, identity});
      job.started = [...(job.started || []), key];
      job.intents ||= {}; job.intents[key] = identity;
    } else if (!matchesIdentity(job.intents?.[key])) throw new Error('Started analysis input changed.');
    value = validate(await generate(root));
  }
  const checkpointIdentity=legacyIdentity && job.intents?.[key]===legacyIdentity ? legacyIdentity : identity;
  await atomicJson(join(root,'accepted.json'), {identity:checkpointIdentity, value});
  signal.throwIfAborted();
  await checkpoint('unit', {key, identity:checkpointIdentity, value});
  job.units ||= {}; job.units[key] = {identity:checkpointIdentity, value};
  return value;
}
