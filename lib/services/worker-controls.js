import { QA_SUPABASE_URL } from '../qa-supabase-env.js';
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
function reject(message) { throw Object.assign(new Error(message), { definite: true }); }
function assertQa(db) { if (db.supabaseUrl?.replace(/\/$/, '') !== QA_SUPABASE_URL) reject('Worker controls are restricted to QA.'); }
export function validateWorkerPause(request) {
  if (!request || Object.keys(request).sort().join() !== 'p_request_id,p_revision,p_worker_id'
    || !uuid.test(request.p_request_id) || !uuid.test(request.p_revision)
    || typeof request.p_worker_id !== 'string' || !request.p_worker_id.length || request.p_worker_id.length > 200) reject('Invalid worker pause request.');
  return request;
}
export async function readWorkers(db, signal) {
  assertQa(db);
  const rows = [], seen = new Set(); let after = null;
  for (;;) {
    const { data, error } = await db.rpc('qa_workers_page', { p_after: after }).abortSignal(signal);
    if (error) throw new Error(error.message || 'Worker pool could not be loaded.');
    if (!Array.isArray(data) || data.length > 200 || data.some((row) => !row || typeof row.worker_id !== 'string'
      || !row.worker_id.length || !uuid.test(row.control_revision) || (row.enabled !== null && typeof row.enabled !== 'boolean')
      || seen.has(row.worker_id))) throw new Error('Worker pool response could not be verified.');
    for (const row of data) { if (seen.has(row.worker_id)) throw new Error('Worker pool page repeated an identity.'); seen.add(row.worker_id); rows.push(row); }
    if (data.length < 200) return rows;
    after = data.at(-1).worker_id;
  }
}
export async function pauseWorker(db, request) {
  assertQa(db); validateWorkerPause(request);
  const { data, error } = await db.rpc('qa_worker_pause', request);
  if (error) throw Object.assign(new Error(error.message || 'Worker pause failed.'), { definite: /^(P0001|22|23|42501)/.test(error.code || '') });
  if (!data || data.requestId !== request.p_request_id || data.workerId !== request.p_worker_id
    || !uuid.test(data.revision) || data.enabled !== false || data.dispatchEnabled !== false || data.operation !== 'pause'
    || !Number.isFinite(Date.parse(data.acknowledgedAt))) throw new Error('Worker pause could not be verified. Recover the pending request.');
  return data;
}
