const ACTIVE_QUEUE_STATUSES = new Set(['claimed', 'classifying', 'processing']);

export function normalizeQueueJob(row) {
  return {
    id: row && row.id ? String(row.id) : '',
    insId: row && row.ins_id ? String(row.ins_id) : '',
    productId: row && row.product_id ? String(row.product_id) : '',
    url: row && row.url ? String(row.url) : '',
    platform: row && row.platform ? String(row.platform) : '',
    status: row && row.status ? String(row.status) : 'pending',
    errorMessage: row && row.error_message ? String(row.error_message) : '',
    queuedAt: row && row.queued_at ? String(row.queued_at) : '',
    processedAt: row && row.processed_at ? String(row.processed_at) : '',
    claimedBy: row && row.claimed_by ? String(row.claimed_by) : '',
    claimedAt: row && row.claimed_at ? String(row.claimed_at) : '',
    workerAssignment: row && row.worker_assignment ? String(row.worker_assignment) : 'auto',
    attempts: Number(row && row.attempts ? row.attempts : 0),
  };
}

export function normalizeWorker(row, nowMs = Date.now()) {
  const lastHeartbeatAt = row && row.last_heartbeat ? Date.parse(row.last_heartbeat) : Number.NaN;
  const heartbeatAgeMs = Number.isFinite(lastHeartbeatAt) ? Math.max(0, nowMs - lastHeartbeatAt) : null;

  return {
    workerId: row && row.worker_id ? String(row.worker_id) : '',
    hostname: row && row.hostname ? String(row.hostname) : '',
    os: row && row.os ? String(row.os) : '',
    pythonVersion: row && row.python_version ? String(row.python_version) : '',
    claudeCodeVersion: row && row.claude_code_version ? String(row.claude_code_version) : '',
    lastHeartbeat: row && row.last_heartbeat ? String(row.last_heartbeat) : '',
    lastJobAt: row && row.last_job_at ? String(row.last_job_at) : '',
    jobsCompletedTotal: Number(row && row.jobs_completed_total ? row.jobs_completed_total : 0),
    jobsFailedTotal: Number(row && row.jobs_failed_total ? row.jobs_failed_total : 0),
    status: row && row.status ? String(row.status) : 'offline',
    currentJobId: row && row.current_job_id ? String(row.current_job_id) : '',
    capabilities: row && row.capabilities && typeof row.capabilities === 'object' ? row.capabilities : {},
    enabled: row ? row.enabled !== false : false,
    createdAt: row && row.created_at ? String(row.created_at) : '',
    heartbeatAgeMs,
    health: workerHealth(row, nowMs),
  };
}

export function workerHealth(worker, nowMs = Date.now(), staleAfterMs = 120000) {
  if (!worker || worker.enabled === false) return 'disabled';
  if (worker.status === 'offline') return 'offline';

  const lastHeartbeatAt = worker.last_heartbeat ? Date.parse(worker.last_heartbeat) : Number.NaN;
  if (!Number.isFinite(lastHeartbeatAt)) return 'unknown';
  if (nowMs - lastHeartbeatAt > staleAfterMs) return 'stale';
  if (worker.status === 'paused') return 'paused';
  if (worker.status === 'busy') return 'busy';
  return 'online';
}

export function isActiveQueueStatus(status) {
  return ACTIVE_QUEUE_STATUSES.has(String(status || '').toLowerCase());
}

export function summarizeQueue(jobs) {
  const summary = {
    total: 0,
    pending: 0,
    active: 0,
    classified: 0,
    failed: 0,
  };

  for (const job of jobs || []) {
    const status = String(job && (job.status || job.status === '') ? job.status : '').toLowerCase();
    summary.total += 1;
    if (status === 'pending') summary.pending += 1;
    else if (isActiveQueueStatus(status)) summary.active += 1;
    else if (status === 'classified' || status === 'done') summary.classified += 1;
    else if (status === 'failed' || status === 'error') summary.failed += 1;
  }

  return summary;
}

export function isClaimStale(job, nowMs = Date.now(), staleAfterMs = 15 * 60 * 1000) {
  if (!job || !isActiveQueueStatus(job.status)) return false;
  const claimedAt = job.claimedAt || job.claimed_at;
  const claimedAtMs = claimedAt ? Date.parse(claimedAt) : Number.NaN;
  return Number.isFinite(claimedAtMs) && nowMs - claimedAtMs > staleAfterMs;
}
