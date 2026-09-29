export function canQueueInspirationWorker(worker, now=Date.now()) {
  return Boolean(worker?.enabled && ((worker.scope==='shared' && worker.recovery_protocol===2)
    || (worker.classifier_available && now-Date.parse(worker.heartbeat_at)<45000)));
}

export function privateInspirationRetry(jobs, inspirationId) {
  const rows = jobs.filter(job => job.inspiration_id === inspirationId);
  if (rows.some(job => ['pending', 'running'].includes(job.status))) throw new Error('This inspiration is already queued or processing.');
  if (rows.some(job => job.status === 'done')) throw new Error('This inspiration already has a published brief.');
  const saved = rows.find(job => job.has_result);
  if (saved && !saved.can_retry_delivery) throw new Error('The saved brief needs delivery review before retrying to avoid a duplicate.');
  if (saved) return { recoveryJobId: saved.id, workerId: saved.worker_id };
  const recovery=rows.find(job=>job.recovery_version===2);
  if (recovery && !recovery.can_retry_processing) throw new Error('Generation may already have run. Review retained output before regenerating.');
  return recovery ? {recoveryJobId:recovery.id,workerId:recovery.worker_id} : {};
}

export function queuedBefore(a, b) {
  return (a.priority ?? a.queuedAt) - (b.priority ?? b.queuedAt) || a.queuedAt - b.queuedAt || a.id.localeCompare(b.id);
}
