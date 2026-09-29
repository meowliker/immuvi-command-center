import { readFile, stat, mkdtemp, rm, mkdir, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';
import { validatePrivateWorkerConfig, privateWorkerHeaders, assertPrivateJob, finishPrivateImages } from '../lib/services/private-worker.js';
import { probeNative, runNativeImages } from './qa-native-image-runner.mjs';
import { validateGeneratedImages } from '../lib/services/qa-image-generation.js';
import { classifierAvailable, classifyPrivateInspiration } from './private-inspiration-runner.mjs';
import { deliverPrivateBrief } from '../lib/services/private-inspiration.js';
import { createPrivateJobPool } from '../lib/services/private-job-pool.js';

import { validateSharedWorkerConfig, assertInspirationJob } from '../lib/services/shared-worker.js';

process.umask(0o077);
const path = process.argv[2];
if (!path) throw new Error('A private device configuration path is required.');
const permissions = await stat(path);
if (permissions.uid !== process.getuid() || (permissions.mode & 0o077)) throw new Error('Worker configuration must be owner-only (0600).');
const input = JSON.parse(await readFile(path, 'utf8'));
const shared = input.scope === 'shared';
const config = shared ? validateSharedWorkerConfig(input) : validatePrivateWorkerConfig(input);
if(shared && (process.env.HOME !== config.runtimeHome || process.env.CODEX_HOME !== join(config.runtimeHome,'.codex'))) throw new Error('Shared worker requires isolated HOME and Codex configuration.');
const capacity = shared ? 1 : 2;
process.env.IMMUVI_CODEX_BIN = config.codexBin;
function client(lease) {
  return createClient(config.url, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: privateWorkerHeaders(config, lease), fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(30000) }) } });
}
const db = client();
async function rpc(name, args = {}) {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error(`${name} failed (${error.code || 'network'}).`);
  return data;
}
let stopped = false, available = false, current = null, enabled = false, classifier = false;
const pool = createPrivateJobPool(capacity), inspirationJobs = new Map();
const abort = new AbortController();
process.on('SIGTERM', () => { stopped = true; abort.abort(); });
process.on('SIGINT', () => { stopped = true; abort.abort(); });
async function heartbeat() {
  const state = await rpc('qa_private_worker_heartbeat', { p_available: available && !stopped });
  if (state.ownerId !== config.ownerId || state.workerId !== config.id || (shared && state.scope !== 'shared')) throw new Error('Worker owner pairing changed.');
  enabled = state.enabled;
  if(shared) {
    try {enabled = enabled && (await readFile(join(dirname(path),'paused'),'utf8')).trim()==='0';}
    catch {enabled=false;}
  }
  await rpc('qa_private_runtime_heartbeat',{p_codex:(available || classifier) && !stopped,p_claude:false,p_classifier:classifier && !stopped});
  for (const job of inspirationJobs.values()) {
    try { await rpc('qa_private_inspiration_checkpoint',{p_id:job.id,p_lease:job.lease_id,p_stage:'heartbeat'}); }
    catch { job.abort.abort(); }
  }
  if (current && !await rpc('qa_private_image_renew', { p_id: current.id, p_lease: current.lease_id })) {
    stopped = true; abort.abort(); throw new Error('Worker job lease was lost.');
  }
}
await heartbeat();
const probe = await mkdtemp(join(tmpdir(), 'immuvi-private-probe-'));
try { available = shared ? false : await probeNative(probe, abort.signal); }
catch { available = false; }
finally { await rm(probe, { recursive: true, force: true }); }
classifier = await classifierAvailable(config);
await heartbeat();
console.log(`${shared?'Shared':'Private'} QA worker online. Native images: ${available}. Inspiration classifier: ${classifier}. Slots: ${capacity}.`);
let heartbeating = false;
const timer = setInterval(async () => {
  if (heartbeating) return;
  heartbeating = true;
  try { await heartbeat(); }
  catch { console.error('Private worker heartbeat failed; no new work will be claimed until connection recovers.'); enabled = false; }
  finally { heartbeating = false; }
}, 10000);
async function processInspiration(job) {
  const jobAbort = new AbortController();
  inspirationJobs.set(job.id,{...job,abort:jobAbort});
  const signal=AbortSignal.any([abort.signal,jobAbort.signal]);
  let directory,completed=false,phase='classification';
  const checkpoint = (stage,value={}) => stage === 'delivery-rejected'
    ? rpc('qa_private_inspiration_delivery_rejected',{p_id:job.id,p_lease:job.lease_id,p_status:value.status,p_code:value.code})
    : stage === 'tracker-rows' ? rpc('qa_private_inspiration_tracker_rows',{p_id:job.id,p_lease:job.lease_id})
    : rpc('qa_private_inspiration_checkpoint',{p_id:job.id,p_lease:job.lease_id,p_stage:stage,p_value:value});
  try {
    directory=await mkdtemp(join(tmpdir(),'immuvi-private-inspiration-'));
    const result=job.result ?? await classifyPrivateInspiration(config,job,directory,signal);
    signal.throwIfAborted();
    phase='saving the generated brief';
    await checkpoint('result',result);
    while (!await rpc('qa_private_inspiration_delivery_lock',{p_id:job.id,p_lease:job.lease_id})) {
      await sleep(1000,undefined,{signal});
    }
    signal.throwIfAborted();
    phase='ClickUp delivery and readback';
    await deliverPrivateBrief({job,result,privateKey:config.deliveryPrivateKey,checkpoint,signal});
    completed=true;
    console.log(`Inspiration ${job.id} completed and ClickUp page verified.`);
  } catch(error) {
    const sourceUnavailable=String(error.message).startsWith('The legacy downloader could not');
    const message=error.code==='FACEBOOK_SNAPSHOT_UNAVAILABLE' ? 'Facebook did not provide the ad data after three page loads. No brief was generated. You can requeue this task; this does not mean the ad is private or requires login.' : shared ? (sourceUnavailable ? 'The legacy downloader could not retrieve this public source. Check public download access; no generation or document was created.' : `Shared QA ${phase} failed; retained evidence requires review. No success was published.`) : String(error.message).slice(0,600);
    await checkpoint('failed',{error:message}).catch(()=>{});
    console.error(`Inspiration ${job.id} failed. ${message}`);
  } finally {
    inspirationJobs.delete(job.id);
    if(directory && completed)await rm(directory,{recursive:true,force:true});
    else if(directory) {
      const failed=join(dirname(path),'failed');
      await mkdir(failed,{recursive:true,mode:0o700});
      await rename(directory,join(failed,job.id)).catch(()=>{});
    }
  }
}
try {
  while (!stopped) {
    try {
      if (!enabled) { await sleep(3000); continue; }
      if(shared) {try {if((await readFile(join(dirname(path),'paused'),'utf8')).trim()!=='0'){await sleep(2000);continue;}}catch{await sleep(2000);continue;}}
      const job = classifier && pool.size<capacity ? await rpc('qa_private_inspiration_claim') : null;
      if (job) {
        assertInspirationJob(config,job);
        void pool.start(job.id,()=>processInspiration(job)).catch(()=>console.error(`Inspiration ${job.id} cleanup failed.`));
        continue;
      }
      if (pool.size || !available) { await sleep(2000); continue; }
      const run = await rpc('qa_private_image_claim');
      if (!run) { await sleep(2000); continue; }
      assertPrivateJob(config, run);
      current = run;
      const directory = await mkdtemp(join(tmpdir(), 'immuvi-private-images-'));
      try {
        const manifest = await runNativeImages(run, directory, abort.signal);
        const images = await validateGeneratedImages(directory, manifest, run.request.options.count);
        if (stopped) throw new Error('Worker was stopped. Review before generating again.');
        await finishPrivateImages(client(run.lease_id), run, images);
        console.log(`Image run ${run.id} completed.`);
      } catch (error) {
        // Only fixed runner errors, never raw CLI transcripts or credentials.
        await rpc('qa_private_image_finish', { p_id: run.id, p_lease: run.lease_id, p_outputs: [],
          p_error: 'Private worker could not complete this run. Check its local log before generating again.' }).catch(() => {});
        console.error(`Image run ${run.id} failed: ${String(error.message).slice(0,400)}`);
      } finally { current = null; await rm(directory, { recursive: true, force: true }); }
    } catch { console.error('Private queue unavailable; retrying in 15 seconds.'); await sleep(15000); }
  }
} finally { await pool.drain(); clearInterval(timer); await heartbeat().catch(() => {}); }
