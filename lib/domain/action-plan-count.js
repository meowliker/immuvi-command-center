import { planLifecycleRows } from './action-plan-visibility.js';

export function savedPlanCount(manualRows, adRows, tombstones, productId) {
  if (!productId) return 0;
  const scoped = (rows) => rows.filter((row) => row.product_id === productId);
  const { actions } = planLifecycleRows(scoped(manualRows), scoped(adRows), scoped(tombstones));
  return new Set(actions.map((row) => row.id).filter((id) => typeof id === 'string' && id.trim())).size;
}
