import { normalizeProductConfig, productClickUpListId } from './product-config.js';
import { CLICKUP_FIELDS, QA_CLICKUP_LIST_ID, validateClickUpMappings } from './clickup-sync.js';

/** @param {any} product @param {{busy?: string, error?: string, hasKey?: boolean, now?: number}} state */
export function commandHqHealth(product, { busy = '', error = '', hasKey = false, now = Date.now() } = {}) {
  const config = normalizeProductConfig(product?.config);
  const listId = productClickUpListId(product);
  const linked = listId === QA_CLICKUP_LIST_ID;
  const rawTime = config.last_synced_at_ms;
  const time = typeof rawTime === 'number' || typeof rawTime === 'string' ? Number(rawTime) : NaN;
  const syncedAt = Number.isFinite(time) && time > 0 && time <= now + 300_000 ? time : null;
  const rawCount = config.last_synced_count;
  const count = typeof rawCount === 'number' || (typeof rawCount === 'string' && rawCount.trim()) ? Number(rawCount) : NaN;
  const taskCount = syncedAt && Number.isSafeInteger(count) && count >= 0 ? count : null;
  const mapping = config.clickup_sync;
  const mappedFields = linked && mapping?.list_id === listId
    ? Object.keys(CLICKUP_FIELDS).filter((key) => typeof mapping.mappings?.[key] === 'string' && mapping.mappings[key].trim()).length : 0;
  const state = !listId ? 'Not linked' : !linked ? 'Blocked list' : busy ? (busy === 'sync' ? 'Syncing' : 'Configuring')
    : error ? 'Needs attention' : !hasKey ? 'Session key required' : !syncedAt ? 'Not synced' : 'Connected';
  return { state, linked, listId, syncedAt, taskCount, mappedFields, canSync: linked && hasKey && !busy };
}

export function verifyClickUpSyncSummary(value) {
  const fields = ['fetched', 'imported', 'updated', 'skipped'];
  if (!value || fields.some((field) => !Number.isSafeInteger(value[field]) || value[field] < 0)
    || value.imported + value.updated + value.skipped > value.fetched) {
    throw new Error('Sync response could not be verified. Refresh product data before retrying.');
  }
  return `${value.fetched} tasks checked: ${value.imported} imported, ${value.updated} updated, ${value.skipped} skipped.`;
}

/** @param {any} value @param {string} listId @param {Record<string, string>|null} [expectedMappings] */
export function verifyClickUpConnection(value, listId, expectedMappings = null) {
  if (!value || listId !== QA_CLICKUP_LIST_ID || value.list?.id !== listId || typeof value.list?.name !== 'string'
    || !Array.isArray(value.fields) || value.fields.some((field) => !field || typeof field.id !== 'string' || !field.id || typeof field.name !== 'string' || typeof field.type !== 'string')
    || value.fields.some((field) => field.type_config?.options != null && (!Array.isArray(field.type_config.options)
      || field.type_config.options.some((option) => !option || typeof option !== 'object'
        || (option.name != null && typeof option.name !== 'string') || (option.label != null && typeof option.label !== 'string'))))
    || new Set(value.fields.map((field) => field.id)).size !== value.fields.length
    || typeof value.productUpdatedAt !== 'string' || !Number.isFinite(Date.parse(value.productUpdatedAt))
    || !value.mappings || typeof value.mappings !== 'object' || Array.isArray(value.mappings)) {
    throw new Error('ClickUp connection response could not be verified. Check the connection again.');
  }
  validateClickUpMappings(value.mappings, value.fields);
  if (expectedMappings && Object.keys(CLICKUP_FIELDS).some((key) => (value.mappings[key] || '') !== (expectedMappings[key] || ''))) {
    throw new Error('Saved ClickUp mappings could not be verified. Check the connection before retrying.');
  }
  return value;
}
