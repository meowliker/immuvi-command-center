import { validatePrivateWorkerConfig } from './private-worker.js';
export const SHARED_QA_PRODUCT='qa-sample-astrorekha';
export function validateSharedWorkerConfig(config) {
 validatePrivateWorkerConfig(config);
 if(config.scope!=='shared' || config.productId!==SHARED_QA_PRODUCT || config.concurrency!==1
 || !config.runtimeHome?.startsWith('/') || !config.pythonBin?.startsWith('/') || !config.deliveryPrivateKey)
  throw new Error('Invalid isolated shared QA worker configuration.');
 return config;
}
export function assertInspirationJob(config,job) {
 const shared=config.scope==='shared';
 if(job.worker_id!==config.id || job.status!=='running' || !job.id || !job.lease_id || !job.requested_by
 || (shared ? job.product_id!==SHARED_QA_PRODUCT || job.context?.listId!=='1301130000002447'
 || job.context?.libraryDocId!=='8cq1r3y-44896' || job.context?.libraryTrackerPageId!=='8cq1r3y-118036'
 : job.requested_by!==config.ownerId)) throw new Error('Inspiration job is outside the assigned worker boundary.');
}
