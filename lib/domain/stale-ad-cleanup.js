import { QA_CLICKUP_LIST_ID } from './clickup-sync.js';
export const CLEANUP_LIST = QA_CLICKUP_LIST_ID;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function validateCleanupRequest(input) {
  if (!input || !['preview','commit'].includes(input.operation) || typeof input.productId !== 'string' || !input.productId || input.productId.length > 200
    || Object.keys(input).some((k) => !(input.operation === 'preview' ? ['operation','productId'] : ['operation','productId','requestId','previewId','confirmName']).includes(k))
    || (input.operation === 'commit' && (!uuid.test(input.requestId) || !uuid.test(input.previewId) || typeof input.confirmName !== 'string' || input.confirmName.length > 200))) {
    throw Object.assign(new Error('Invalid stale-ad cleanup request.'), { definite: true });
  }
  return input;
}
export function cleanupTaskIds(tasks) {
  if (!Array.isArray(tasks) || !tasks.length || tasks.length > 40000) throw new Error('A complete nonempty ClickUp snapshot is required. Cleanup is blocked.');
  const ids = new Set();
  for (const task of tasks) {
    if (typeof task.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(task.id) || String(task.list?.id) !== CLEANUP_LIST || ids.has(task.id)) throw new Error('ClickUp task identities are incomplete or inconsistent. Cleanup is blocked.');
    ids.add(task.id);
  }
  return [...ids].sort();
}
export function verifyCleanupPreview(result, productId) {
  if (result?.productId !== productId || result.listId !== CLEANUP_LIST || !uuid.test(result.previewId) || typeof result.productName !== 'string'
    || !Number.isFinite(Date.parse(result.expiresAt)) || !Number.isSafeInteger(result.remoteCount) || result.remoteCount < 1
    || !Array.isArray(result.candidates) || result.candidates.length > 500 || !result.protected || typeof result.protected !== 'object'
    || Object.values(result.protected).some((n) => !Number.isSafeInteger(n) || n < 0)
    || result.candidates.some((row) => typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.taskId !== 'string')
    || new Set(result.candidates.map((row) => row.id)).size !== result.candidates.length || result.dispatchEnabled !== false) throw new Error('Cleanup preview could not be verified.');
  return result;
}
export function verifyCleanupReceipt(result, input) {
  if (result?.requestId !== input.requestId || result.previewId !== input.previewId || result.productId !== input.productId
    || result.dispatchEnabled !== false || !Array.isArray(result.deletedIds) || result.deletedIds.length > 500
    || result.deletedIds.some((id) => typeof id !== 'string') || new Set(result.deletedIds).size !== result.deletedIds.length) throw new Error('Cleanup result could not be verified. Recover the same request.');
  return result;
}
