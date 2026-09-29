import { planBatchItems, PLAN_BATCH_LIMIT } from '../domain/action-plan-workspace.js';

/** @param {string | null} value */
export async function savePlanBatch(db, productId, actions, operation, value = null) {
  if (!['status', 'due', 'remove'].includes(operation)) throw new Error('Unsupported bulk operation.');
  const result = await db.rpc('qa_plan_batch', {
    p_product_id: productId, p_items: planBatchItems(actions), p_operation: operation, p_value: value,
  });
  if (result.error) throw new Error(result.error.message || 'Could not save Action Plan changes.');
  if (!Array.isArray(result.data) || result.data.length !== actions.length) throw new Error('Incomplete save response. Refresh before retrying.');
  return result.data;
}

// Never retry an external request here: create/recovery owns durable idempotency.
/** @param {{shouldStop?: () => boolean, onProgress?: (results: Array<{id: string, title: string, state: string, message: string}>) => void}} options */
export async function runPlanPush(actions, send, options = {}) {
  const { shouldStop = () => false, onProgress = () => {} } = options;
  if (!actions.length || actions.length > PLAN_BATCH_LIMIT) throw new Error(`Select between 1 and ${PLAN_BATCH_LIMIT} visible tasks.`);
  const results = [];
  for (const action of actions) {
    let result = { id: action.display.dbId, title: action.display.title, state: 'skipped', message: 'Not sent.' };
    if (!shouldStop()) {
      try {
        result = { ...result, ...await send(action) };
      } catch (error) {
        result = { ...result, state: 'failed', message: error instanceof Error ? error.message : 'Request failed.' };
      }
    }
    results.push(result);
    onProgress([...results]);
  }
  return results;
}
