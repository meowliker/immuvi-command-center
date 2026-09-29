export function planHiddenIds(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string' || !id.trim())) {
    throw new Error('Saved hidden tasks are invalid. Refresh or contact your admin.');
  }
  return [...new Set(value)];
}

export function setPlanHidden(value, id, hidden) {
  if (typeof id !== 'string' || !id.trim() || typeof hidden !== 'boolean') throw new Error('A creative identity and visibility are required.');
  const ids = planHiddenIds(value);
  return hidden ? [...new Set([...ids, id])] : ids.filter((item) => item !== id);
}

export function planHiddenCount(actions, hiddenIds) {
  return new Set(actions.map((action) => action.display.linkedAdId).filter((id) => id && hiddenIds.has(id))).size;
}

// Keep deletion and quarantine identities available before filtering candidates;
// otherwise a stale action can attach to a different creative via title fallback.
export function planLifecycleRows(manualRows, adRows, tombstones = []) {
  const blocked = new Map();
  const ids = (row) => [row.id, row.clickup_task_id, row.meta?._clickupId, row.meta?.clickupTaskId].filter(Boolean);
  const remember = (row) => {
    const set = blocked.get(row.product_id) || new Set();
    ids(row).forEach((id) => set.add(id)); blocked.set(row.product_id, set);
  };
  const unavailable = (row) => Boolean(row.deleted_at || row.meta?.deletedAt || row.meta?.deleted_at || row.meta?._productBoundaryQuarantined);
  tombstones.forEach(remember);
  adRows.filter(unavailable).forEach(remember);
  const ads = adRows.filter((row) => !unavailable(row) && !ids(row).some((id) => blocked.get(row.product_id)?.has(id)));
  const actions = manualRows.filter((row) => {
    const p = row.payload || {};
    if (row.deleted_at || p._productBoundaryQuarantined || p.deletedAt || p.deleted_at) return false;
    const references = [p.sourceAdId || p.adId || p._sourceAdId, p._clickupId, p.clickupTaskId].filter(Boolean);
    return !references.some((id) => blocked.get(row.product_id)?.has(id));
  });
  return { actions, ads };
}
