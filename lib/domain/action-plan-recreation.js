import { planDeletionTarget } from './action-plan-deletion.js';

export function planRecreationTarget(productId, action) {
  const target = planDeletionTarget(productId, action);
  if (!/^[a-zA-Z0-9_-]+$/.test(target.taskId) || (!action.display.isVirtual && !action.actionVersion)) throw new Error('A current linked ClickUp task is required.');
  return { ...target, actionId: action.display.isVirtual ? null : action.display.dbId,
    actionVersion: action.display.isVirtual ? null : action.actionVersion };
}
