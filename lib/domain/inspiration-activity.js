import { queuedBefore } from './private-inspiration-queue.js';
const active = new Set(['claimed', 'classifying', 'processing', 'running']);
const complete = new Set(['classified', 'done', 'completed']);
const timestamp = value => { const parsed = Date.parse(value || ''); return Number.isFinite(parsed) ? parsed : 0; };

export function activityStatus(status, assignment = '') {
  if (status === 'ready') return 'ready';
  if (complete.has(status)) return 'done';
  if (['failed', 'error', 'cancelled'].includes(status)) return 'failed';
  if (String(assignment).startsWith('blocked:') || status === 'blocked') return 'blocked';
  if (active.has(status)) return 'running';
  return ['pending', 'queued'].includes(status) ? 'pending' : 'unknown';
}

/** @param {{productId:string,queue?:Record<string,any>[],briefs?:Record<string,any>[],images?:Record<string,any>[],ads?:Record<string,any>[],inspirations?:Record<string,any>[]}} input */
export function inspirationActivity({ productId, queue = [], briefs = [], images = [], ads = [], inspirations = [] }) {
  const scopedAds = new Map(ads.filter(row => row.product_id === productId).map(row => [row.id, row]));
  const sources = new Map(inspirations.filter(row => row.productId === productId).map(row => [row.id, row]));
  const jobs = queue.filter(row => row.productId === productId).map(row => {
    const source = sources.get(row.insId), status = activityStatus(row.status, row.workerAssignment);
    return { id: `inspiration:${row.id}`, kind: 'Inspiration', target: row.insId, title: source?.formatName || row.insId || row.id,
      status, stage: status === 'running' ? row.status === 'claimed' ? 'Claimed by worker' : 'Classifying / preparing brief' : status === 'done' ? 'Classification complete' : status === 'ready' ? 'Ready to process' : status === 'blocked' ? 'Dispatch blocked' : status === 'pending' ? 'Waiting for classifier' : row.status,
      brief: source?.briefUrl ? 'Brief link available' : source?.editFields?._classificationBrief ? 'Stored brief available' : status === 'done' ? 'Brief not available' : '',
      privateJobId: row.privateJobId, priority: row.priority,
      worker: row.claimedBy, assignment: row.workerAssignment, queuedAt: timestamp(row.queuedAt), startedAt: timestamp(row.claimedAt), finishedAt: timestamp(row.processedAt), error: row.errorMessage };
  });
  for (const row of briefs) {
    if (!scopedAds.has(row.parent_ad_id) || !scopedAds.has(row.target_ad_id)) continue;
    const status = activityStatus(row.status);
    jobs.push({ id: `brief:${row.id}`, kind: 'Variation brief', target: row.target_ad_id, title: scopedAds.get(row.target_ad_id)?.format_name || row.target_ad_id,
      status, stage: status === 'running' ? 'Generating variation brief' : status === 'done' ? 'Brief created (worker reported)' : status === 'pending' ? 'Waiting for brief worker' : row.status,
      brief: '', worker: row.claimed_by || '', assignment: 'auto', queuedAt: timestamp(row.created_at), startedAt: timestamp(row.claimed_at), finishedAt: timestamp(row.processed_at), error: row.error_message || '' });
  }
  for (const row of images) {
    if (row.product_id !== productId) continue;
    const status = activityStatus(row.status);
    jobs.push({ id: `image:${row.id}`, kind: 'Ad images', target: row.ad_id, title: scopedAds.get(row.ad_id)?.format_name || row.ad_id,
      status, stage: status === 'running' ? 'Generating / validating / storing images' : status === 'done' ? `${Array.isArray(row.outputs) ? row.outputs.length : 0} images stored` : status === 'pending' ? 'Waiting for image worker' : row.status,
      brief: '', worker: 'local-native', assignment: 'local-native', queuedAt: timestamp(row.created_at), startedAt: timestamp(row.started_at), finishedAt: timestamp(row.finished_at), error: row.error || '' });
  }
  const rank = { running: 0, pending: 1, ready:2, blocked: 3, failed: 4, unknown: 5, done: 6 };
  return jobs.sort((a, b) => rank[a.status] - rank[b.status] || (a.status==='pending' ? queuedBefore(a,b) : b.queuedAt - a.queuedAt));
}

/** @param {Record<string,any>} job @param {Record<string,any>[]} jobs @param {{classifierWorkers?:string[],imageOnline?:boolean,now?:number}} options */
export function activityEstimate(job, jobs, { classifierWorkers = [], imageOnline = false, now = Date.now() } = {}) {
  if (job.status === 'ready') return {text:'Not started',basis:''};
  if (['done', 'failed'].includes(job.status)) return { text: 'Finished', basis: '' };
  if (job.status === 'blocked') return { text: 'Blocked', basis: 'Dispatch must be enabled before an estimate is available.' };
  if (job.status === 'unknown') return { text: 'Unavailable', basis: 'No recognized worker stage.' };
  const workers = job.kind === 'Ad images' ? (imageOnline ? ['local-native'] : []) : classifierWorkers;
  const assigned = job.worker || (job.assignment !== 'auto' && !job.assignment.startsWith('preferred:') ? job.assignment : '');
  if (!workers.length || (assigned && !workers.includes(assigned))) return { text: 'Waiting for worker', basis: 'No healthy worker for this job.' };
  const samples = jobs.filter(row => row.kind === job.kind && row.status === 'done' && row.startedAt > 0 && row.finishedAt > row.startedAt && row.finishedAt <= now)
    .sort((a,b) => b.finishedAt-a.finishedAt).slice(0,20).map(row => row.finishedAt-row.startedAt).sort((a,b) => a-b);
  const duration = samples.length ? samples[Math.floor(samples.length / 2)] : job.kind === 'Inspiration' ? 90_000 : 0;
  if (!duration) return { text: 'Unavailable', basis: 'No completed runs with timing data yet.' };
  const elapsed = job.startedAt > 0 ? Math.max(0, now-job.startedAt) : 0;
  if (job.status === 'running' && elapsed >= duration) return { text: 'Longer than estimated', basis: 'Still running; no reliable remaining time.' };
  const ahead = jobs.filter(row => row.id!==job.id && (row.kind === 'Ad images') === (job.kind === 'Ad images') && (row.status === 'running' || row.status === 'pending' && queuedBefore(row,job)<0)).length;
  const remaining = job.status === 'running' ? duration-elapsed : duration*(1+Math.floor(ahead/workers.length));
  return { text: `~${Math.max(1,Math.ceil(remaining/60_000))} min`, basis: samples.length ? `Approximate, based on ${samples.length} completed ${job.kind.toLowerCase()} runs; queue waits may vary.` : 'Legacy estimate: about 90 seconds per inspiration; queue waits may vary.' };
}
