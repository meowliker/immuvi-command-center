export const TRACKER_BULK_FIELDS = ['creativeStructure', 'hookType', 'productionStyle', 'angle', 'persona', 'funnelStage'];

export function trackerBulkValues(creative) {
  return Object.fromEntries(TRACKER_BULK_FIELDS.flatMap((key) => {
    const value = creative[key];
    return typeof value === 'string' && value.trim() && value.trim() !== '\u2014' ? [[key, value]] : [];
  }));
}

export function trackerBulkSelection(creatives, productId) {
  const items = [], tasks = new Set();
  let skipped = 0;
  for (const creative of creatives) {
    if (creative.productId !== productId) continue;
    if (creative.deletedAt || creative.productBoundaryQuarantined || !creative.clickupTaskId || !Object.keys(trackerBulkValues(creative)).length) { skipped++; continue; }
    if (!creative.version) throw new Error('Refresh the Tracker before pushing: a creative has no saved version.');
    if (tasks.has(creative.clickupTaskId)) throw new Error('Multiple creatives share a ClickUp task. Resolve the duplicate link before pushing all.');
    tasks.add(creative.clickupTaskId);
    items.push({ id: creative.id, title: creative.formatName || creative.id, version: creative.version, taskId: creative.clickupTaskId });
  }
  return { items, skipped };
}
