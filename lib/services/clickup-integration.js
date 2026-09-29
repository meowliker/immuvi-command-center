import { buildClickUpImport, inferClickUpMappings, validateClickUpMappings, assertQaClickUpList } from '../domain/clickup-sync.js';
import { productClickUpListId } from '../domain/product-config.js';
import { runTrackerClickUp } from './tracker-clickup.js';
import { pushAllCreativeFields } from './tracker-bulk-push.js';
import { runClickUpCreation } from './clickup-creation.js';
import { readProductRows } from './product-rows.js';
import { readPlanLinkedDone } from './action-plan-linked-done.js';
import { deletePlanRemoteTask } from './action-plan-remote-deletion.js';
import { repairPlanClickUp } from './action-plan-recreation.js';
import { reviewOneScaleLaunch } from './action-plan-onescale.js';
import { syncInspirationSourceType } from './inspiration-source-sync.js';
import { findInspirationBrief } from './inspiration-brief.js';
export { readProductRows } from './product-rows.js';

export async function runClickUpIntegration({ db, clickup, product, profile, input, signal }) {
  // Identity is read-only and does not require a linked task list. App access is checked by the route.
  if (input.operation === 'identity') return { user: await clickup.identity() };
  const listId = input.operation === 'inspect' || input.operation === 'link' ? String(input.listId || '') : productClickUpListId(product);
  assertQaClickUpList(listId);
  if (input.operation === 'push-all-creative-fields') return pushAllCreativeFields({ db, clickup, product, listId, input, signal });
  if (input.operation === 'inspiration-brief') return findInspirationBrief({ db, clickup, product, listId, input, profile });
  if (input.operation === 'sync-inspiration-type') return syncInspirationSourceType({ db, clickup, product, listId, input, signal });
  if (input.operation === 'review-onescale') return reviewOneScaleLaunch({ db, clickup, product, listId, input, signal });
  if (input.operation === 'repair-plan-task') return repairPlanClickUp({ db, clickup, product, listId, input, signal });
  if (input.operation === 'delete-plan-task') return deletePlanRemoteTask({ db, clickup, product, listId, input, signal });
  if (input.operation === 'plan-linked-done') return readPlanLinkedDone({ db, clickup, product, listId, input, signal });
  if (input.operation === 'plan-statuses') {
    const schema = await clickup.inspect(listId);
    return { statuses: schema.list.statuses || [] };
  }
  if (input.operation === 'create-plan-task') return runClickUpCreation({ db,clickup,product,listId,input });
  if (['creative-schema', 'push-creative', 'delete-creative-task', 'winner-comment'].includes(input.operation)) {
    return runTrackerClickUp({ db, clickup, product, listId, input });
  }
  if (['inspect', 'link'].includes(input.operation)) {
    if (profile.role !== 'admin') throw new Error('Only an administrator can configure the ClickUp list.');
    const schema = await clickup.inspect(listId);
    if (input.operation === 'inspect') return { ...schema, productUpdatedAt: product.updated_at, mappings: inferClickUpMappings(schema.fields) };
    const mappings = validateClickUpMappings(input.mappings || inferClickUpMappings(schema.fields), schema.fields);
    const result = await db.rpc('save_qa_clickup_link', { p_product_id: product.id, p_list_id: listId,
      p_list_name: schema.list.name, p_mappings: mappings, p_expected_updated_at: input.expectedUpdatedAt });
    if (result.error) throw new Error(result.error.message);
    if (!result.data) throw new Error('Product settings changed. Refresh before saving the list.');
    return { ...schema, productUpdatedAt: result.data.updated_at, mappings };
  }
  if (input.operation === 'sync') {
    // Snapshot local state before fetching remote data; the RPC rejects intervening local edits.
    const [ads, actions, tombstones] = await Promise.all([
      readProductRows(db, 'ads', product.id, signal),
      readProductRows(db, 'manual_actions', product.id, signal),
      readProductRows(db, 'deleted_ads', product.id, signal),
    ]);
    const [schema, tasks] = await Promise.all([clickup.inspect(listId), clickup.tasks(listId)]);
    const mappings = inferClickUpMappings(schema.fields);
    const plan = buildClickUpImport({ productId: product.id, listId, tasks, ads, actions, tombstones, mappings });
    signal?.throwIfAborted();
    if (input.prepareOnly === true) return { productId: product.id, listId, productUpdatedAt: product.updated_at, plan };
    const result = await db.rpc('apply_qa_clickup_sync', {
      p_product_id: product.id, p_list_id: listId, p_expected_updated_at: product.updated_at, p_plan: plan,
    });
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }
  if (input.operation === 'update-task') {
    const ads = await readProductRows(db, 'ads', product.id, signal);
    const actions = await readProductRows(db, 'manual_actions', product.id, signal);
    if (!ads.some((ad) => !ad.deleted_at && (ad.clickup_task_id || ad.meta?._clickupId) === input.taskId) &&
        !actions.some((action) => (action.payload?._clickupId || action.payload?.clickupTaskId) === input.taskId)) {
      throw new Error('This task is not linked to the selected product.');
    }
    await clickup.updateTask(listId, input.taskId, input.fields || {});
    return { updated: true };
  }
  if (input.operation === 'create-recommendation') {
    const result = await db.from('strategist_recommendations').select('*, competitor_creatives(ad_url)').eq('product_id', product.id).eq('id', input.recommendationId).single();
    if (result.error || !result.data) throw new Error('Recommendation is not available for this product.');
    const rec = result.data;
    if (rec.task_id) return { id: rec.task_id };
    return clickup.createTask(listId, {
      name: rec.recommended_hook || rec.recommended_format || 'Strategist test',
      description: ['Created from an Immuvi strategist recommendation.', `Angle: ${rec.recommended_angle || '-'}`,
        `Persona: ${rec.recommended_persona || '-'}`, `Format: ${rec.recommended_format || '-'}`,
        rec.reasoning ? `Reasoning: ${rec.reasoning}` : '',
        rec.competitor_creatives?.ad_url ? `Source: ${rec.competitor_creatives.ad_url}` : '',
      ].filter(Boolean).join('\n'),
      tags: ['production', 'app-created', 'strategist'],
    });
  }
  throw new Error('Unknown ClickUp operation.');
}
