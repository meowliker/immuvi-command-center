import { explicitPlanSource } from './action-plan-editing.js';
import { PLAN_BATCH_LIMIT } from './action-plan-workspace.js';

export const ONESCALE_QA_BLOCKED = 'OneScale launch is disabled: no isolated test environment, store, or product profile has been confirmed.';
export const readyToLaunch = (status) => String(status || '').trim().toLowerCase() === 'ready to launch';
export const oneScaleTaskIds = (row, action = false) => (action
  ? [row?.payload?._clickupId, row?.payload?.clickupTaskId]
  : [row?.clickup_task_id, row?.meta?._clickupId, row?.meta?.clickupTaskId]).filter(Boolean);

export function validateOneScaleTargets(targets) {
  if (!Array.isArray(targets) || !targets.length || targets.length > PLAN_BATCH_LIMIT) throw new Error(`Select 1 to ${PLAN_BATCH_LIMIT} ready-to-launch tasks.`);
  for (const target of targets) {
    if (!target || typeof target.adId !== 'string' || !target.adId || typeof target.adVersion !== 'string' || !target.adVersion
      || typeof target.taskId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(target.taskId)
      || (target.actionId !== null && (typeof target.actionId !== 'string' || !target.actionId || typeof target.actionVersion !== 'string' || !target.actionVersion))
      || (target.actionId === null && target.actionVersion !== null)) throw new Error('A current creative, action, and real ClickUp task identity are required.');
  }
  if (new Set(targets.map((t) => t.adId)).size !== targets.length || new Set(targets.map((t) => t.taskId)).size !== targets.length
    || new Set(targets.map((t) => t.actionId).filter(Boolean)).size !== targets.filter((t) => t.actionId).length) throw new Error('Resolve duplicate creative or task links before reviewing a launch.');
  return targets;
}

export function oneScaleTargets(productId, actions) {
  return validateOneScaleTargets(actions.map((action) => {
    const d = action.display, meta = action.linkedAdMeta || {}, payload = action.payload || {};
    if (!d || d.productId !== productId || !readyToLaunch(d.status) || !d.linkedAdId || explicitPlanSource(action) !== d.linkedAdId
      || meta._productBoundaryQuarantined || payload._productBoundaryQuarantined || meta._clickupTaskDeleted || payload._clickupTaskDeleted) throw new Error('Only ready-to-launch tasks with explicit, active creative links can be reviewed.');
    const ids = [d.clickupTaskId, payload._clickupId, payload.clickupTaskId, meta._clickupId, meta.clickupTaskId].filter(Boolean);
    if (new Set(ids).size !== 1) throw new Error('Resolve missing or conflicting ClickUp task links before reviewing a launch.');
    return { adId: d.linkedAdId, adVersion: action.adVersion, taskId: d.clickupTaskId,
      actionId: d.isVirtual ? null : d.dbId, actionVersion: d.isVirtual ? null : action.actionVersion };
  }));
}
