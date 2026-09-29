import { assertQaClickUpList } from '../domain/clickup-sync.js';
import { readProductRows } from './product-rows.js';

const taskIds = (ad) => [ad.clickup_task_id, ad.meta?._clickupId, ad.meta?.clickupTaskId].filter(Boolean);
const actionTasks = (action) => [action.payload?._clickupId, action.payload?.clickupTaskId].filter(Boolean);

export async function deletePlanRemoteTask({ db, clickup, product, listId, input, signal }) {
  assertQaClickUpList(listId);
  if (typeof input.adId !== 'string' || !input.adId || typeof input.taskId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(input.taskId)) throw new Error('A confirmed creative and task identity are required.');
  const result = await db.from('ads').select('*').eq('product_id', product.id).eq('id', input.adId).maybeSingle();
  const ad = result.data;
  if (result.error || !ad || ad.product_id !== product.id || !ad.deleted_at || ad.meta?._productBoundaryQuarantined
    || !taskIds(ad).length || taskIds(ad).some((id) => id !== input.taskId)) throw new Error('Deleted creative or ClickUp identity changed. Refresh before retrying.');
  const tombstone = await db.from('deleted_ads').select('*').eq('product_id', product.id).eq('id', input.adId).maybeSingle();
  if (tombstone.error || tombstone.data?.product_id !== product.id || tombstone.data?.id !== ad.id || tombstone.data?.clickup_task_id !== input.taskId) throw new Error('A matching QA deletion tombstone is required.');
  const [ads, actions, jobs] = await Promise.all(['ads', 'manual_actions', 'qa_clickup_creations'].map((table) => readProductRows(db, table, product.id, signal)));
  if (ads.some((row) => !row.deleted_at && taskIds(row).includes(input.taskId)) || actions.some((row) => actionTasks(row).includes(input.taskId))) throw new Error('Another active record still references this ClickUp task. Resolve its links first.');
  if (jobs.some((job) => job.ad_id === ad.id && !['linked', 'rejected'].includes(job.state))) throw new Error('Recover unresolved ClickUp creation before deleting its task.');
  signal?.throwIfAborted();
  // The client verifies membership in the QA list; a confirmed 404 is idempotent.
  await clickup.deleteTask(listId, input.taskId);
  return { deleted: true, adId: ad.id, taskId: input.taskId };
}
