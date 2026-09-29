import { assertQaClickUpList } from '../domain/clickup-sync.js';
import { ONESCALE_QA_BLOCKED, readyToLaunch, oneScaleTaskIds, validateOneScaleTargets } from '../domain/action-plan-onescale.js';
import { readProductRows } from './product-rows.js';

const sources = (row) => [row?.payload?.sourceAdId, row?.payload?.adId, row?.payload?._sourceAdId].filter(Boolean);
const blocked = (meta) => meta?._productBoundaryQuarantined || meta?._clickupTaskDeleted;

// Readiness is a point-in-time review, never a launch authorization or mutation.
export async function reviewOneScaleLaunch({ db, clickup, product, listId, input, signal }) {
  assertQaClickUpList(listId);
  const targets = validateOneScaleTargets(input.targets);
  const ads = await readProductRows(db, 'ads', product.id, signal);
  const actions = await readProductRows(db, 'manual_actions', product.id, signal);
  const tombstones = await readProductRows(db, 'deleted_ads', product.id, signal);
  const jobs = await readProductRows(db, 'qa_clickup_creations', product.id, signal);
  if ([...ads, ...actions, ...tombstones, ...jobs].some((row) => row.product_id !== product.id)) throw new Error('Product scope could not be verified.');
  const tasks = targets.map((target) => {
    const ad = ads.find((row) => row.id === target.adId);
    if (!ad || ad.deleted_at || blocked(ad.meta) || !readyToLaunch(ad.status)) throw new Error('Creative is not available for launch review.');
    if (ad.updated_at !== target.adVersion) throw new Error('Creative changed. Close and reopen the launch review.');
    const linked = actions.filter((row) => sources(row).includes(ad.id) || oneScaleTaskIds(row, true).includes(target.taskId));
    const action = linked.find((row) => row.id === target.actionId);
    if (target.actionId ? linked.length !== 1 || !action || action.updated_at !== target.actionVersion || blocked(action.payload)
      || !readyToLaunch(action.live_status || action.payload?.liveStatus) || !sources(action).length || sources(action).some((id) => id !== ad.id)
      : linked.length !== 0) throw new Error('Action Plan changed or has conflicting links. Close and reopen the launch review.');
    const ids = [...oneScaleTaskIds(ad), ...oneScaleTaskIds(action, true)];
    if (!ids.length || ids.some((id) => id !== target.taskId)) throw new Error('ClickUp task identity changed.');
    if (ads.some((row) => row.id !== ad.id && oneScaleTaskIds(row).includes(target.taskId))) throw new Error('Another creative owns this ClickUp task.');
    if (tombstones.some((row) => row.id === ad.id || row.clickup_task_id === target.taskId)) throw new Error('A deletion tombstone blocks launch review.');
    if (jobs.some((row) => (row.ad_id === ad.id || (action && row.action_id === action.id)) && ['sending', 'uncertain', 'created'].includes(row.state))) throw new Error('Recover unresolved ClickUp creation before reviewing a launch.');
    return { adId: ad.id, taskId: target.taskId, title: ad.format_name || target.taskId };
  });
  // Verify every local target before making any remote read; never skip bad rows.
  for (const task of tasks) {
    signal?.throwIfAborted();
    const remote = await clickup.getTask(listId, task.taskId);
    if (String(remote?.id) !== task.taskId || String(remote?.list?.id) !== listId || remote?.archived
      || !readyToLaunch(remote?.status?.status)) throw new Error(`ClickUp task ${task.taskId} is not ready to launch in the QA list.`);
  }
  signal?.throwIfAborted();
  return { productId: product.id, tasks, checkedAt: new Date().toISOString(), externalLaunchEnabled: false, blockedReason: ONESCALE_QA_BLOCKED };
}
