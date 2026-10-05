import { validatePrivateWorkerConfig } from './private-worker.js';
import { QA_DESTINATIONS, qaDestination } from '../domain/qa-destinations.js';
export const SHARED_QA_PRODUCT='qa-sample-astrorekha';
export const APPROVED_PRODUCT_IDS=Object.freeze(QA_DESTINATIONS.map(destination=>destination.productId));
export function workerDestination(productId, context, {library=false,tracker=false}={}) {
 const destination=qaDestination(productId);
 if(!destination || context?.listId!==destination.listId
 || (context.productId!=null && context.productId!==productId)
 || (context.product?.id!=null && context.product.id!==productId)
 || (context.workspaceId!=null && context.workspaceId!==destination.workspaceId)
 || ((library || context.libraryDocId!=null) && context.libraryDocId!==destination.libraryDocId)
 || ((tracker || context.libraryTrackerPageId!=null) && context.libraryTrackerPageId!==destination.libraryTrackerPageId)) throw new Error('Unapproved worker destination.');
 return destination;
}
export function assertWorkerProduct(worker,productId,now=Date.now()) {
 if(!qaDestination(productId))throw new Error('Unapproved worker product.');
 if(productId!==SHARED_QA_PRODUCT && (!Array.isArray(worker.approved_product_ids)
 || worker.approved_product_ids.length!==APPROVED_PRODUCT_IDS.length
 || !APPROVED_PRODUCT_IDS.every(id=>worker.approved_product_ids.includes(id))
 || !(now-Date.parse(worker.heartbeat_at)<45000)
 || (worker.destinations_heartbeat_at!=null && !(now-Date.parse(worker.destinations_heartbeat_at)<45000))))
  throw new Error('Selected worker has not attested support for this product.');
}
export async function attestWorkerDestinations(rpc,stopped=false) {
 const protocol=await rpc('qa_worker_destinations_heartbeat',{p_product_ids:stopped?[]:[...APPROVED_PRODUCT_IDS]});
 if(protocol!==true)throw new Error('Worker destination database contract is unavailable.');
}
export function validateSharedWorkerConfig(config) {
 validatePrivateWorkerConfig(config);
 if(config.scope!=='shared' || config.productId!==SHARED_QA_PRODUCT || config.concurrency!==1
 || !config.runtimeHome?.startsWith('/') || !config.pythonBin?.startsWith('/') || !config.deliveryPrivateKey)
  throw new Error('Invalid isolated shared QA worker configuration.');
 return config;
}
export function assertInspirationJob(config,job) {
 const shared=config.scope==='shared';
 workerDestination(job.product_id,job.context,{library:shared || job.product_id!==SHARED_QA_PRODUCT,tracker:shared || job.product_id!==SHARED_QA_PRODUCT});
 if(job.worker_id!==config.id || job.status!=='running' || !job.id || !job.lease_id || !job.requested_by
 || (!shared && job.requested_by!==config.ownerId)) throw new Error('Inspiration job is outside the assigned worker boundary.');
}
