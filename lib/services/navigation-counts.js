import { navigationCounts } from '../domain/navigation-counts.js';
import { readProductRows } from './product-rows.js';

const columns = {
  angles: 'id,product_id',
  personas: 'id,product_id',
  competitor_brands: 'id,product_id,approved',
  ads: 'id,product_id,angle,persona,parent_ad_id,clickup_task_id,deleted_at,meta',
  deleted_ads: 'id,product_id,clickup_task_id',
  manual_actions: 'id,product_id,payload',
  inspirations: 'id,product_id',
};
export const NAVIGATION_COUNT_TABLES = Object.keys(columns);

export async function readNavigationCounts(db, productId, signal) {
  if (!productId) throw new Error('A product is required for tab counts.');
  const rows = await Promise.all(NAVIGATION_COUNT_TABLES.map(async (table) =>
    [table, await readProductRows(db, table, productId, signal, columns[table])]));
  return navigationCounts(Object.fromEntries(rows), productId);
}
