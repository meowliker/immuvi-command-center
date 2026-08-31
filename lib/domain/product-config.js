const PRESERVED_CONFIG_KEYS = [
  'clickup_list_id',
  'clickup_list_name',
  'tracker_saved_views',
  'tracker_active_view_by_user',
  'production',
  'doc_id',
  'ins_prefix',
];

function parseConfig(config) {
  if (!config) return {};
  if (typeof config === 'string') {
    try {
      const parsed = JSON.parse(config);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof config === 'object' && !Array.isArray(config) ? { ...config } : {};
}

function definedEntries(source) {
  return Object.entries(source || {}).filter(([, value]) => value !== undefined);
}

export function normalizeProductConfig(config) {
  const normalized = parseConfig(config);

  if (normalized.clickupListId !== undefined && normalized.clickup_list_id === undefined) {
    normalized.clickup_list_id = normalized.clickupListId;
  }

  if (normalized.clickupListName !== undefined && normalized.clickup_list_name === undefined) {
    normalized.clickup_list_name = normalized.clickupListName;
  }

  delete normalized.clickupListId;
  delete normalized.clickupListName;

  return normalized;
}

export function productClickUpListId(product) {
  if (!product) return '';
  const config = normalizeProductConfig(product.config);
  return String(product.clickupListId || config.clickup_list_id || '').trim();
}

export function productClickUpListName(product) {
  if (!product) return '';
  const config = normalizeProductConfig(product.config);
  return String(product.clickupListName || config.clickup_list_name || '').trim();
}

export function mergeProductConfig(existing, next) {
  const base = normalizeProductConfig(existing);
  const incoming = normalizeProductConfig(next);
  const merged = { ...base };

  for (const key of PRESERVED_CONFIG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(base, key)) merged[key] = base[key];
  }

  for (const [key, value] of definedEntries(incoming)) {
    merged[key] = value;
  }

  return merged;
}

export function productRowToView(productRow) {
  if (!productRow) return null;
  const config = normalizeProductConfig(productRow.config);

  return {
    ...productRow,
    config,
    clickupListId: String(config.clickup_list_id || '').trim(),
    clickupListName: String(config.clickup_list_name || '').trim(),
  };
}

export { PRESERVED_CONFIG_KEYS };
