import { explicitPlanSource } from './action-plan-editing.js';

export function planDeletionTarget(productId, action) {
  const d = action?.display;
  if (!d?.linkedAdId || d.productId !== productId || explicitPlanSource(action) !== d.linkedAdId
    || !action.adVersion || action.linkedAdMeta?._productBoundaryQuarantined || action.payload?._productBoundaryQuarantined) {
    throw new Error('An explicit, current creative link is required before deleting.');
  }
  const tasks = [d.clickupTaskId, action.payload?._clickupId, action.payload?.clickupTaskId,
    action.linkedAdMeta?._clickupId, action.linkedAdMeta?.clickupTaskId].filter(Boolean);
  if (new Set(tasks).size > 1) throw new Error('Resolve conflicting ClickUp links before deleting.');
  return { productId, adId: d.linkedAdId, title: d.title, taskId: d.clickupTaskId || '', version: action.adVersion, deletedAt: '' };
}

export function deletedPlanTargets(productId, ads, tombstones) {
  const ids = new Map(tombstones.filter((row) => row.product_id === productId).map((row) => [row.id, row]));
  return ads.flatMap((ad) => {
    const tombstone = ids.get(ad.id), taskId = ad.clickup_task_id || ad.meta?._clickupId || ad.meta?.clickupTaskId || '';
    if (ad.product_id !== productId || !ad.deleted_at || !tombstone || ad.meta?._productBoundaryQuarantined
      || (tombstone.clickup_task_id || '') !== taskId) return [];
    return [{ productId, adId: ad.id, title: ad.format_name || ad.id, taskId, version: ad.updated_at || '', deletedAt: ad.deleted_at }];
  }).sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)) || a.adId.localeCompare(b.adId));
}
