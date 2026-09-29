import { normalizeTaxonomyName } from './taxonomy.js';
import { safeCreativeUrl } from './tracker-editing.js';

const operations = ['create', 'save', 'archive', 'restore', 'delete', 'merge'];
const version = (row) => {
  if (!row?.id || (row.updatedAt && !Number.isFinite(Date.parse(row.updatedAt)))) throw new Error('A versioned taxonomy entry is required.');
  return { id: row.id, version: row.updatedAt || null };
};

/** @param {string} productId @param {'angle'|'persona'} kind @param {string} operation
 * @param {{id:string,updatedAt?:string}[]} rows @param {{name:string,sourceLink?:string,notes?:string}|null} draft
 * @param {{id:string,updatedAt?:string}|null} target @param {string} requestId */
export function taxonomyRequest(productId, kind, operation, rows = [], draft = null, target = null, requestId = crypto.randomUUID()) {
  /** @type {{sources: {id:string,version:string|null}[],fields?: {name:string,source_link:string,notes:string},target?:{id:string,version:string|null},renameRevision?:string}} */
  const values = { sources: rows.map(version).sort((a, b) => a.id.localeCompare(b.id)) };
  if (['create', 'save'].includes(operation)) {
    const name = normalizeTaxonomyName(draft?.name);
    const source = String(draft?.sourceLink || '').trim();
    const notes = String(draft?.notes || '').trim();
    if (!name || name.length > 200) throw new Error('Name must be 1-200 characters.');
    if (source && !safeCreativeUrl(source)) throw new Error('Source must be an HTTP or HTTPS URL.');
    if (source.length > 2000 || notes.length > 20000) throw new Error('Source or notes are too long.');
    values.fields = { name, source_link: source, notes };
  }
  if (operation === 'merge') values.target = version(target);
  const request = { p_product_id: productId, p_request_id: requestId, p_kind: kind, p_operation: operation, p_values: values };
  validateTaxonomyRequest(request);
  return request;
}

export function validateTaxonomyRequest(request) {
  const v = request?.p_values;
  const validRow = (row) => row && typeof row.id === 'string' && row.id && Object.hasOwn(row, 'version')
    && (row.version === null || typeof row.version === 'string' && Number.isFinite(Date.parse(row.version)));
  if (!request?.p_product_id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.p_request_id || '')
    || !['angle', 'persona'].includes(request.p_kind) || !operations.includes(request.p_operation)
    || !v || !Array.isArray(v.sources) || v.sources.some((row) => !validRow(row)) || v.sources.length > 50
    || new Set(v.sources.map((row) => row.id)).size !== v.sources.length
    || (request.p_operation === 'create' ? v.sources.length !== 0 : request.p_operation === 'merge' ? !v.sources.length || !validRow(v.target) || v.sources.some((row) => row.id === v.target.id) : v.sources.length !== 1)) {
    throw new Error('Invalid taxonomy request.');
  }
  if (['create', 'save'].includes(request.p_operation) && (!v.fields || typeof v.fields.name !== 'string' || !v.fields.name.trim()
    || typeof v.fields.source_link !== 'string' || typeof v.fields.notes !== 'string')) throw new Error('Invalid taxonomy fields.');
  if (Object.hasOwn(v, 'renameRevision') && (request.p_operation !== 'save' || typeof v.renameRevision !== 'string' || !/^[a-f0-9]{32}$/.test(v.renameRevision))) throw new Error('Invalid rename preview revision.');
  return request;
}
