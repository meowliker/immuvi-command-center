export function privateInspirationRetry(jobs, inspirationId) {
  const rows = jobs.filter(job => job.inspiration_id === inspirationId);
  if (rows.some(job => ['pending', 'running'].includes(job.status))) throw new Error('This inspiration is already queued or processing.');
  if (rows.some(job => job.status === 'done')) throw new Error('This inspiration already has a published brief.');
  const saved = rows.find(job => job.has_result);
  if (saved && !saved.can_retry_delivery) throw new Error('The saved brief needs delivery review before retrying to avoid a duplicate.');
  return saved ? { recoveryJobId: saved.id, workerId: saved.worker_id } : {};
}

export function queuedBefore(a, b) {
  return (a.priority ?? a.queuedAt) - (b.priority ?? b.queuedAt) || a.queuedAt - b.queuedAt || a.id.localeCompare(b.id);
}
