import type { Creative } from '../types';
import { listWorkflowStatuses } from '../../../lib/domain/clickup-statuses.js';

export function isLikelyClickUpTaskId(value: string) {
  const taskId = value.trim();
  return Boolean(taskId && !taskId.startsWith('manual-') && /^[a-z0-9]+$/i.test(taskId));
}

function isProductionCreative(creative: Creative) {
  const status = creative.status.trim().toLowerCase();
  return creative.taskType === 'production'
    || ['in production', 'ready to launch', 'testing', 'winner', 'scale', 'complete'].includes(status)
    || Boolean(creative.sourceFormatId);
}

const creativeWorkflowStatuses = [
  'Untested',
  'Approved',
  'Assigned',
  'In Production',
  'Ready to Launch',
  'Testing',
  'Winner',
  'Mild Winner',
  'Scale',
  'Complete',
  'Loser',
  'Killed',
];

export function workflowStatuses(currentStatus: string, listStatuses?: { status: string }[]) {
  const statuses = listStatuses === undefined ? creativeWorkflowStatuses : listWorkflowStatuses(listStatuses);
  return statuses.includes(currentStatus) || !currentStatus ? statuses : [currentStatus, ...statuses];
}
