export const PRODUCTION_COLUMNS = [
  { id: 'queue', title: 'In Queue', subtitle: 'Untested / Approved' },
  { id: 'progress', title: 'In Production', subtitle: 'In Production / Ready to Launch / Testing' },
  { id: 'done', title: 'Done', subtitle: 'Winner / Mild Winner / Scale / Complete / Loser / Killed' },
];

export function productionBucket(value) {
  const status = String(value || '').trim().toLowerCase();
  if (['winner', 'mild winner', 'scale', 'complete', 'loser', 'killed'].includes(status)) return 'done';
  if (['in production', 'ready to launch', 'testing'].includes(status)) return 'progress';
  return 'queue';
}

export function productionDropStatus(currentStatus, columnId) {
  const statuses = { queue: 'Untested', progress: 'In Production', done: 'Complete' };
  if (!Object.hasOwn(statuses, columnId)) throw new Error('Unknown production column.');
  return productionBucket(currentStatus) === columnId ? null : statuses[columnId];
}
export const PRODUCTION_FORMATS = ['Storytelling Music Style','UGC Format','AI Style','New Angle + UGC','Old Winner Video 1','Old Winner Video 2','Old Winner Photo','New Angle + Photo','Teacher Angle','Competitor Reference'];
