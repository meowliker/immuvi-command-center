import { explicitPlanSource } from './action-plan-editing.js';

export function planLinkedCandidates(actions) {
  const seen = new Set();
  return actions.flatMap((action) => {
    const d = action.display;
    if (String(d.status).trim().toLowerCase() !== 'ready to launch' || !d.clickupTaskId || !d.linkedAdId || !action.adVersion
      || d.clickupTaskDeleted || action.linkedAdMeta?._productBoundaryQuarantined
      || explicitPlanSource(action) !== d.linkedAdId || seen.has(d.linkedAdId)) return [];
    seen.add(d.linkedAdId);
    return [{ adId: d.linkedAdId, taskId: d.clickupTaskId, version: action.adVersion }];
  }).sort((a, b) => a.adId.localeCompare(b.adId));
}

export const PLAN_LINKED_DONE_TTL = 5 * 60_000;
export function planLinkedCacheKey(scope, item) { return JSON.stringify([scope, item.adId, item.taskId, item.version]); }
