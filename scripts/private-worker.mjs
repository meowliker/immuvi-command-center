import { readFile, stat, mkdtemp, rm, mkdir, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';
import { validatePrivateWorkerConfig, privateWorkerHeaders, assertPrivateJob, finishPrivateImages } from '../lib/services/private-worker.js';
import { probeNative, runNativeImages, generateSharedVariation, downloadImage } from './qa-native-image-runner.mjs';
import { assertSharedImageJob, recoverSharedImages } from '../lib/services/shared-image-recovery.js';
import { createSharedImageDelivery } from '../lib/services/shared-image-delivery.js';
import { validateGeneratedImages } from '../lib/services/qa-image-generation.js';
import { classifierAvailable, classifyPrivateInspiration, extractLegacyMedia, classifyExtractedInspiration } from './private-inspiration-runner.mjs';
import { deliverPrivateBrief, validateInspirationResult } from '../lib/services/private-inspiration.js';
import { recoveryDirectory, recoverInspiration, recoveryFailure, createRecoveryLeaseGuard } from '../lib/services/shared-inspiration-recovery.js';
import { createPrivateJobPool } from '../lib/services/private-job-pool.js';
import { analysisAvailable, executeSharedAnalysis } from './shared-analysis-runner.mjs';
import { assertAnalysisJob } from '../lib/services/shared-analysis-recovery.js';

import { validateSharedWorkerConfig, assertInspirationJob, attestWorkerDestinations, APPROVED_PRODUCT_IDS } from '../lib/services/shared-worker.js';
import { createReleaseUpdater, readReleaseState, atomicJson, fetchApprovedRelease, stageWorkerRelease, managedUpdatesEnabled } from '../lib/services/shared-worker-updates.js';
import { watchSupervisorConnection, waitForWorkerActivation } from '../lib/services/shared-worker-supervisor.js';
import { resolveConfiguredCodexExecutable } from '../lib/services/codex-executable.js';

process.umask(0o077);
const path = process.argv[2];
if (!path) throw new Error('A private device configuration path is required.');
const permissions = await stat(path);
if (permissions.uid !== process.getuid() || (permissions.mode & 0o077)) throw new Error('Worker configuration must be owner-only (0600).');
const input = JSON.parse(await readFile(path, 'utf8'));
const shared = input.scope === 'shared';
const configured = shared ? validateSharedWorkerConfig(input) : validatePrivateWorkerConfig(input);
const config = { ...configured, codexBin: await resolveConfiguredCodexExecutable(configured.codexBin) };
const managed = shared && process.env.IMMUVI_MANAGED_QA_WORKER === '1' && !!process.send;
const update = managed ? createReleaseUpdater({
  isIdle:()=>!stopped && !pool.size && !current,
  readState:()=>readReleaseState(dirname(path)),
  saveState:value=>atomicJson(join(dirname(path),'release-state.json'),value),
  fetchRelease:async()=>await managedUpdatesEnabled(dirname(path)) ? fetchApprovedRelease() : null,
  stageRelease:release=>stageWorkerRelease({release,directory:dirname(path),bootstrapRoot:process.env.IMMUVI_QA_BOOTSTRAP_ROOT,pythonBin:config.pythonBin,signal:abort.signal}),
  onError:message=>console.error(message),
}) : null;
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
  if (error) throw Object.assign(new Error(`${name} failed (${error.code || 'network'}).`),{code:error.code || 'NETWORK_UNAVAILABLE'});
  return data;
}
let stopped = false, available = false, current = null, enabled = false, classifier = false, analysis = false, lastAnalysisProbe = 0;
const pool = createPrivateJobPool(capacity), inspirationJobs = new Map();
const abort = new AbortController();
process.on('SIGTERM', () => { stopped = true; abort.abort(); });
process.on('SIGINT', () => { stopped = true; abort.abort(); });
// A launcher crash must not leave an orphan claiming work alongside its replacement.
const stopWatchingSupervisor = managed ? watchSupervisorConnection(process, () => {
  stopped = true; abort.abort();
}) : null;
async function heartbeat() {
  const state = await rpc('qa_private_worker_heartbeat', { p_available: available && !stopped });
  if (state.ownerId !== config.ownerId || state.workerId !== config.id || (shared && state.scope !== 'shared')) throw new Error('Worker owner pairing changed.');
  enabled = state.enabled;
  if(shared) {
    try {enabled = enabled && (await readFile(join(dirname(path),'paused'),'utf8')).trim()==='0';}
    catch {enabled=false;}
  }
  const protocol=await rpc(shared?'qa_shared_analysis_heartbeat':'qa_private_runtime_heartbeat',
    {p_codex:(shared?analysis:available || classifier) && !stopped,p_claude:false,p_classifier:classifier && (!shared || analysis) && !stopped,...(shared?{p_images:available && analysis && !stopped}:{})});
  if(shared && protocol!==1)throw new Error('Shared analysis database contract is unavailable.');
  // Credential headers bind this attestation to the running binary. Registration
  // remains anchored to Astro; the ordinary heartbeat must clear old attestations.
  await attestWorkerDestinations(rpc,stopped);
  for (const job of inspirationJobs.values()) {
    const startedAt=Date.now();
    if (job.guard && !job.guard.check()) continue;
    try {
      await rpc('qa_private_inspiration_checkpoint',{p_id:job.id,p_lease:job.lease_id,p_stage:'heartbeat'});
      job.guard?.renew(startedAt);
    }
    catch { job.abort.abort(); }
  }
  if(current && shared) {
    const startedAt=Date.now();
    if(current.guard.check()) {
      try {await rpc(current.kind?'qa_analysis_checkpoint':'qa_shared_image_checkpoint',{p_id:current.id,p_lease:current.lease_id,p_stage:'heartbeat'});current.guard.renew(startedAt);}
      catch {current.abort.abort();}
    }
  } else if (current && !await rpc('qa_private_image_renew', { p_id: current.id, p_lease: current.lease_id })) {
    stopped = true; abort.abort(); throw new Error('Worker job lease was lost.');
  }
}
await heartbeat();
const probe = await mkdtemp(join(tmpdir(), 'immuvi-private-probe-'));
try { available = await probeNative(probe, abort.signal); }
catch { available = false; }
finally { await rm(probe, { recursive: true, force: true }); }
classifier = await classifierAvailable(config);
analysis = shared && await analysisAvailable(config);
lastAnalysisProbe=Date.now();
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
const leaseWatchdog=shared ? setInterval(()=>{
  for (const job of inspirationJobs.values()) job.guard?.check();
  current?.guard?.check();
},1000) : null;
async function processSharedImage(run) {
  assertSharedImageJob(config,run);
  const jobAbort=new AbortController(),signal=AbortSignal.any([abort.signal,jobAbort.signal]);
  current={...run,abort:jobAbort,guard:createRecoveryLeaseGuard(jobAbort)};
  const directory=join(dirname(path),'images',run.id);
  const checkpoint=(stage,value={})=>rpc('qa_shared_image_checkpoint',{p_id:run.id,p_lease:run.lease_id,p_stage:stage,p_value:value});
  let completed=false;
  try {
    const delivery=createSharedImageDelivery({run,privateKey:config.deliveryPrivateKey,signal,checkpoint,
      download:downloadImage,extract:(url,dir,s)=>extractLegacyMedia(config,url,dir,s)});
    const {outputs}=await recoverSharedImages({run,directory,signal,checkpoint,prepare:()=>delivery.prepare(directory),
      generate:args=>generateSharedVariation(args,signal),storage:client(run.lease_id).storage.from('qa-producer-images'),deliver:delivery.deliver});
    await delivery.finish(outputs);completed=true;
    console.log(`Shared image run ${run.id} completed and ClickUp attachments verified.`);
  } catch(error) {
    const transient=recoveryFailure(error,signal).retry;
    await checkpoint(transient?'retry':'failed',transient?{}:{error:error.code==='IMAGE_OUTCOME_UNCERTAIN'?error.message:
      'Shared Producer could not complete delivery. Accepted images and receipts are retained; review before generating again.'}).catch(()=>{});
    console.error(`Shared image run ${run.id} ${transient?'awaits recovery':'needs review'}.`);
  } finally {
    current=null;
    if(completed)await rm(directory,{recursive:true,force:true});
  }
}
async function processAnalysis(job) {
  assertAnalysisJob(config,job);
  const jobAbort=new AbortController(),signal=AbortSignal.any([abort.signal,jobAbort.signal]);
  current={...job,abort:jobAbort,guard:createRecoveryLeaseGuard(jobAbort)};
  const directory=join(dirname(path),'analysis',job.id);
  const checkpoint=(stage,value={})=>rpc('qa_analysis_checkpoint',{p_id:job.id,p_lease:job.lease_id,p_stage:stage,p_value:value});
  try {
    await executeSharedAnalysis({config,job,directory,checkpoint,signal});
    console.log(`Shared ${job.kind} ${job.id} completed and persisted.`);
  } catch(error) {
    const retry=recoveryFailure(error,signal).retry;
    const actionable=/^(Generation was interrupted|Saved analysis|Started analysis|Analysis input changed|Winner page|Page creation outcome|ClickUp analysis request|Task moved|Facebook did not|The legacy downloader)/.test(error.message || '')
      ? String(error.message).slice(0,600) : 'Shared analysis needs review. Saved output is retained; resume the same run after checking worker evidence.';
    await checkpoint(retry?'retry':'failed',retry?{}:{error:actionable}).catch(()=>{});
    console.error(`Shared ${job.kind} ${job.id} ${retry?'awaits recovery':'requires review'}.`);
  } finally {current=null;}
}
async function processInspiration(job) {
  const jobAbort = new AbortController();
  const recoverable=shared && job.recovery_version===2;
  const guard=recoverable ? createRecoveryLeaseGuard(jobAbort) : null;
  inspirationJobs.set(job.id,{...job,abort:jobAbort,guard});
  const signal=AbortSignal.any([abort.signal,jobAbort.signal]);
  let directory,completed=false,phase='classification';
  const checkpoint = (stage,value={}) => stage === 'delivery-rejected'
    ? rpc('qa_private_inspiration_delivery_rejected',{p_id:job.id,p_lease:job.lease_id,p_status:value.status,p_code:value.code})
    : stage === 'tracker-rows' ? rpc('qa_private_inspiration_tracker_rows',{p_id:job.id,p_lease:job.lease_id})
    : rpc('qa_private_inspiration_checkpoint',{p_id:job.id,p_lease:job.lease_id,p_stage:stage,p_value:value});
  try {
    directory=recoverable ? recoveryDirectory(dirname(path),job) : await mkdtemp(join(tmpdir(),'immuvi-private-inspiration-'));
    const result=recoverable ? await recoverInspiration({job,directory,signal,checkpoint,
      extract:()=>extractLegacyMedia(config,job.source_url,directory,signal),
      generate:media=>classifyExtractedInspiration(config,job,media,directory,signal),validate:validateInspirationResult})
      : job.result ?? await classifyPrivateInspiration(config,job,directory,signal);
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
    const recovery=recoverable ? recoveryFailure(error,signal) : {retry:false};
    if (recovery.retry) {
      await checkpoint('retry',{reason:recovery.reason}).catch(()=>{});
      console.error(`Inspiration ${job.id} interrupted; retained checkpoints will be reviewed on recovery.`);
      return;
    }
    const sourceUnavailable=String(error.message).startsWith('The legacy downloader could not');
    const message=error.code==='FACEBOOK_SNAPSHOT_UNAVAILABLE' ? 'Facebook did not provide the ad data after three page loads. No brief was generated. You can requeue this task; this does not mean the ad is private or requires login.' : shared ? (sourceUnavailable ? 'The legacy downloader could not retrieve this public source. Check public download access; no generation or document was created.' : `Shared QA ${phase} failed; retained evidence requires review. No success was published.`) : String(error.message).slice(0,600);
    const actionable=recoverable && ['GENERATION_OUTCOME_UNCERTAIN','RECOVERY_CHECKPOINT_INVALID'].includes(error.code)
      ? error.message : recoverable && [401,403].includes(error.status) ? 'ClickUp authorization was refused. Your saved brief is retained; reconnect your key or correct Doc access, then requeue.' : message;
    await checkpoint('failed',{error:actionable}).catch(()=>{});
    console.error(`Inspiration ${job.id} failed. ${message}`);
  } finally {
    inspirationJobs.delete(job.id);
    if(directory && completed)await rm(directory,{recursive:true,force:true});
    else if(directory && !recoverable) {
      const failed=join(dirname(path),'failed');
      await mkdir(failed,{recursive:true,mode:0o700});
      await rename(directory,join(failed,job.id)).catch(()=>{});
    }
  }
}
try {
  if (managed) {
    await waitForWorkerActivation(process,{classifier,signal:abort.signal});
  }
  while (!stopped) {
    try {
      if (update && await update()) {
        console.log('Approved QA release staged; restarting while idle.');
        process.exitCode=75;stopped=true;break;
      }
      if (stopped) break;
      if(shared && !pool.size && !current && Date.now()-lastAnalysisProbe>=60000) {
        lastAnalysisProbe=Date.now();analysis=await analysisAvailable(config);await heartbeat();
      }
      if (!enabled) { await sleep(3000); continue; }
      if(shared) {try {if((await readFile(join(dirname(path),'paused'),'utf8')).trim()!=='0'){await sleep(2000);continue;}}catch{await sleep(2000);continue;}}
      const currentExecutable = await resolveConfiguredCodexExecutable(config.codexBin).catch(() => null);
      if (currentExecutable !== config.codexBin) {
        // Let existing work settle; the next process must re-probe the moved
        // binary before any new job can be claimed.
        if (pool.size || current) { await sleep(2000); continue; }
        console.error('Codex executable changed or disappeared; restarting before new claims.');
        process.exitCode=75;stopped=true;break;
      }
      const job = classifier && pool.size<capacity ? await rpc(shared?'qa_shared_inspiration_claim':'qa_private_inspiration_claim') : null;
      if (job) {
        assertInspirationJob(config,job);
        void pool.start(job.id,()=>processInspiration(job)).catch(()=>console.error(`Inspiration ${job.id} cleanup failed.`));
        continue;
      }
      if (pool.size) { await sleep(2000); continue; }
      if (shared && analysis) {
        const analysisJob=await rpc('qa_analysis_claim');
        if(analysisJob){await processAnalysis(analysisJob);continue;}
      }
      if (!available) { await sleep(2000); continue; }
      const run = await rpc(shared?'qa_shared_image_claim':'qa_private_image_claim');
      if (!run) { await sleep(2000); continue; }
      if(shared){await processSharedImage(run);continue;}
      assertPrivateJob(config, run);
      if(!APPROVED_PRODUCT_IDS.includes(run.product_id))throw new Error('Private image product is not approved.');
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
} finally {
  await pool.drain();clearInterval(timer);if(leaseWatchdog)clearInterval(leaseWatchdog);await heartbeat().catch(()=>{});
  stopWatchingSupervisor?.();
  if (managed && process.connected) process.disconnect();
}
