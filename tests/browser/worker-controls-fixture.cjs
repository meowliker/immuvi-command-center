const { randomUUID } = require('node:crypto');
module.exports = function pause(data, request, control) {
  control.workerCalls ||= []; control.workerReceipts ||= new Map(); control.workerCalls.push(structuredClone(request));
  const prior = control.workerReceipts.get(request.p_request_id);
  if (prior) return JSON.stringify(prior.request) === JSON.stringify(request) ? prior.result : { code: 'P0001', message: 'Worker request identity conflicts' };
  const worker = data.worker_registry.find((row) => row.worker_id === request.p_worker_id);
  if (!worker) return { code: 'P0001', message: 'Worker is unavailable. Refresh and review.' };
  if (worker.control_revision !== request.p_revision) return { code: 'P0001', message: 'Worker control changed. Refresh and review.' };
  worker.enabled = false; worker.control_revision = randomUUID();
  const result = { requestId: request.p_request_id, workerId: worker.worker_id, enabled: false, dispatchEnabled: false, operation: 'pause', revision: worker.control_revision, acknowledgedAt: new Date().toISOString() };
  control.workerReceipts.set(request.p_request_id, { request: structuredClone(request), result });
  return result;
};
