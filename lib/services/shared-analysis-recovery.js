import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { atomicJson } from './shared-worker-updates.js';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}

export function assertAnalysisJob(config, job) {
  if (config.scope !== 'shared' || job.worker_id !== config.id || job.product_id !== 'qa-sample-astrorekha'
    || !/^[a-f0-9-]{36}$/.test(job.id || '') || !job.lease_id || job.status !== 'running'
    || !['variation','strategist'].includes(job.kind) || job.context?.listId !== '1301130000002447'
    || job.context?.libraryDocId !== '8cq1r3y-44896') throw new Error('Analysis job is outside shared QA.');
}

// Each generated unit has its own start fence and immutable result. An expired
// lease is not permission to repeat a model call with an unknown outcome.
export async function recoverAnalysisUnit({job, key, input, directory, checkpoint, generate, validate, signal, replaySafe=false,
  decodeRaw=text=>JSON.parse(text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''))}) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(key)) throw new Error('Invalid analysis unit.');
  const identity = createHash('sha256').update(JSON.stringify(canonical([job.id, job.kind, job.context, input]))).digest('hex');
  const root = join(directory, key);
  await mkdir(root, {recursive:true, mode:0o700});
  const saved = job.units?.[key];
  if (saved) {
    if (saved.identity !== identity) throw new Error('Analysis input changed; saved output requires review.');
    return validate(saved.value);
  }
  let disk;
  try { disk = JSON.parse(await readFile(join(root,'accepted.json'),'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  let value;
  if (disk) {
    if (disk.identity !== identity) throw new Error('Saved analysis identity changed.');
    value = validate(disk.value);
  } else if (job.started?.includes(key) && !replaySafe) {
    if (job.intents?.[key] !== identity) throw new Error('Started analysis input changed; review required.');
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
    } else if (job.intents?.[key] !== identity) throw new Error('Started analysis input changed.');
    value = validate(await generate(root));
  }
  await atomicJson(join(root,'accepted.json'), {identity, value});
  signal.throwIfAborted();
  await checkpoint('unit', {key, identity, value});
  job.units ||= {}; job.units[key] = {identity, value};
  return value;
}
