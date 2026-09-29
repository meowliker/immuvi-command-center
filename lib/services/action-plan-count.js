import { savedPlanCount } from '../domain/action-plan-count.js';
import { readProductRows } from './product-rows.js';

export async function readSavedPlanCount(db, productId, signal) {
  if (!productId) throw new Error('A product is required for Action Plan counts.');
  const [actions, ads, tombstones] = await Promise.all([
    readProductRows(db, 'manual_actions', productId, signal, 'id,product_id,payload'),
    readProductRows(db, 'ads', productId, signal, 'id,product_id,clickup_task_id,deleted_at,meta'),
    readProductRows(db, 'deleted_ads', productId, signal, 'id,product_id,clickup_task_id'),
  ]);
  return savedPlanCount(actions, ads, tombstones, productId);
}
