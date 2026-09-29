import { HQ_FIELD_OPTIONS } from './command-hq.js';
import { PRODUCT_FIELD_DESCRIPTIONS } from './product-field-defaults.js';

export function productInitials(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean).map((word) => Array.from(word)[0].toUpperCase()).join('').slice(0, 3) || 'INS';
}

export const FIELD_CATALOG_LABELS = { creativeStructure: 'Creative structure', hookType: 'Hook type', productionStyle: 'Production style' };

/** @returns {Record<string, {name:string,desc:string}[]>} */
export function productFieldCatalog(config = {}) {
  const saved = config.field_options;
  return Object.fromEntries(Object.keys(FIELD_CATALOG_LABELS).map((key) => [key,
    Array.isArray(saved?.[key]) ? saved[key].filter((item) => item && typeof item.name === 'string' && item.name.trim()).map((item) => ({ name: item.name, desc: String(item.desc || '') }))
      : HQ_FIELD_OPTIONS[key].map((name) => ({ name, desc: PRODUCT_FIELD_DESCRIPTIONS[key][name] || '' })),
  ]));
}

export function validateFieldCatalog(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 3) throw new Error('All three field catalogs are required.');
  for (const key of Object.keys(FIELD_CATALOG_LABELS)) {
    if (!Array.isArray(value[key]) || value[key].length > 100) throw new Error('Each field allows up to 100 options.');
    const names = new Set();
    for (const item of value[key]) {
      if (!item || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 200 || item.name !== item.name.trim()
        || typeof item.desc !== 'string' || item.desc.length > 2000 || Object.keys(item).some((field) => !['name', 'desc'].includes(field))) throw new Error('Each option needs a name (up to 200 characters) and description (up to 2000).');
      const normalized = item.name.toLowerCase();
      if (names.has(normalized)) throw new Error(`Duplicate ${FIELD_CATALOG_LABELS[key]} option: ${item.name}`);
      names.add(normalized);
    }
  }
  return value;
}

export function productAdminRequest(operation, product, values = {}, requestId = crypto.randomUUID()) {
  const request = { p_request_id: requestId, p_operation: operation, p_product_id: product?.id || `qa-prod-${requestId}`,
    p_expected_updated_at: product?.updated_at || null, p_values: structuredClone(values) };
  return validateProductAdminRequest(request);
}

export function validateProductAdminRequest(request) {
  if (!request || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(request.p_request_id || '') || !request.p_product_id
    || !['create', 'fields', 'unlink', 'delete'].includes(request.p_operation) || !request.p_values || typeof request.p_values !== 'object'
    || Array.isArray(request.p_values) || (request.p_expected_updated_at !== null && !Number.isFinite(Date.parse(request.p_expected_updated_at)))) throw new Error('Invalid product request.');
  const { p_values: value, p_operation: operation } = request;
  if (operation === 'create' && (request.p_product_id !== `qa-prod-${request.p_request_id}` || typeof value.name !== 'string'
    || !value.name.trim() || value.name !== value.name.trim() || value.name.length > 200 || !/^#[\da-f]{6}$/i.test(value.color || ''))) throw new Error('Enter a product name and valid color.');
  if (operation === 'fields') validateFieldCatalog(value.catalog);
  if (['unlink', 'delete'].includes(operation) && (typeof value.confirmName !== 'string' || !value.confirmName)) throw new Error('Confirm the exact product name.');
  if (operation === 'delete' && !/^[\da-f]{32}$/i.test(value.revision || '')) throw new Error('Preview the product deletion first.');
  return request;
}
