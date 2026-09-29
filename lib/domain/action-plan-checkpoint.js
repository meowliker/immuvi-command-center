import { explicitPlanSource } from './action-plan-editing.js';

export const PLAN_TESTING_DECISIONS = ['Winner', 'Mild Winner', 'Scale', 'Loser'];
export function checkpointReview(action, age, ad) {
  const available = Boolean(action?.display.linkedAdId && explicitPlanSource(action) === action.display.linkedAdId
    && (action.actionVersion || action.display.isVirtual) && action.adVersion && !action.display.clickupTaskDeleted
    && !action.linkedAdMeta?._productBoundaryQuarantined && ['first', 'final'].includes(age?.phase)
    && String(action.display.status).trim().toLowerCase() === 'testing');
  return { available, canSnooze: available && age.phase === 'first' && ad?.testingDeferCount === 0 && !ad?.testingDeferredAt };
}

export function checkpointArguments(productId, action, decision) {
  if (![...PLAN_TESTING_DECISIONS, 'snooze'].includes(decision)) throw new Error('Invalid testing decision.');
  if (!action?.display.linkedAdId || explicitPlanSource(action) !== action.display.linkedAdId || action.display.productId !== productId
    || !action.actionVersion || !action.adVersion || action.display.clickupTaskDeleted) throw new Error('Reload this linked QA task before reviewing it.');
  return { p_product_id: productId, p_action_id: action.display.dbId, p_expected_updated_at: action.actionVersion,
    p_ad_id: action.display.linkedAdId, p_ad_updated_at: action.adVersion, p_decision: decision };
}
