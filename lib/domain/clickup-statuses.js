import { clickUpStatus } from './clickup-sync.js';

export function matchingClickUpStatus(value, statuses) {
  const wanted = String(value || '').trim().toLowerCase();
  const entries = Array.isArray(statuses) ? statuses : [];
  const exact = entries.find(item => item.status?.trim().toLowerCase() === wanted);
  if (exact) return exact.status;
  const aliases = entries.filter(item => clickUpStatus(item.status).toLowerCase() === wanted);
  if (aliases.length === 1) return aliases[0].status;
  throw new Error(`Status "${value}" is not available in the linked ClickUp list. Choose a list status or add it in ClickUp first.`);
}

export function listWorkflowStatuses(statuses) {
  return [...new Set((statuses || []).filter(item => typeof item.status === 'string' && item.status.trim())
    .map(item => clickUpStatus(item.status)))];
}
