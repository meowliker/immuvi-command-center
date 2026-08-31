export function isDeletedAd(row) {
  if (!row) return false;
  return Boolean(row.deleted_at || row.deletedAt);
}

export function adIdentifiers(row) {
  if (!row) return [];

  return [
    row.id,
    row._clickupId,
    row.clickupTaskId,
    row.clickup_task_id,
  ]
    .filter((value) => value !== undefined && value !== null && String(value).trim())
    .map((value) => String(value).trim());
}

export function isTombstonedAd(row, tombstones = []) {
  const tombstoneSet = tombstones instanceof Set ? tombstones : new Set(tombstones);
  return isDeletedAd(row) || adIdentifiers(row).some((id) => tombstoneSet.has(id));
}
