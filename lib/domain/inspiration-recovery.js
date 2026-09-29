import { inspirationLink } from './inspiration-library.js';

export function inspirationRecoveryIssue(row,productId) {
  const queue=row?.queueSnapshot;
  if(!row?.queueOnly || row.productId!==productId || !queue?.id || queue.product_id!==productId || queue.ins_id!==row.id) return 'A queue-only entry in the active product is required.';
  if(!['failed','error','blocked','classified','done','completed'].includes(String(queue.status).toLowerCase()))return 'Only terminal or blocked queue entries can be recovered. Active jobs must finish first.';
  if(!inspirationLink(queue.url) || queue.url.length>4000)return 'The queue source URL is invalid. Recovery cannot guess a replacement.';
  if(!row.id?.trim() || row.id.length>200)return 'The queue source identity is invalid.';
  return '';
}
export function inspirationRecoveryRequest(productId,row,requestId=crypto.randomUUID()) {
  const issue=inspirationRecoveryIssue(row,productId);if(issue)throw new Error(issue);
  return {p_product_id:productId,p_request_id:requestId,p_queue_id:row.queueSnapshot.id,p_expected_queue:structuredClone(row.queueSnapshot)};
}
