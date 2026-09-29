import { QA_SUPABASE_URL } from '../qa-supabase-env.js';
import { validateProductAdminRequest } from '../domain/product-administration.js';

function assertQa(db) {
  if (db.supabaseUrl?.replace(/\/$/, '') !== QA_SUPABASE_URL) throw Object.assign(new Error('Product administration is restricted to QA.'), { definite: true });
}
export async function previewProductDeletion(db, productId) {
  assertQa(db);
  const { data, error } = await db.rpc('qa_product_delete_preview', { p_product_id: productId });
  if (error) throw new Error(error.message);
  if (data?.productId !== productId || !/^[\da-f]{32}$/.test(data.revision || '') || !data.counts
    || Object.values(data.counts).some((n) => !Number.isSafeInteger(n) || n < 0) || typeof data.blocked !== 'boolean') throw new Error('Deletion preview could not be verified.');
  return data;
}
export async function mutateProduct(db, request) {
  assertQa(db); validateProductAdminRequest(request);
  const { data, error } = await db.rpc('qa_product_mutate', request);
  if (error) throw Object.assign(new Error(error.message || 'Product change failed.'), { definite: /^(P0001|22|23|42501)/.test(error.code || '') });
  const invalid = () => { throw new Error('Product save could not be verified. Retry the same request.'); };
  if (data?.requestId !== request.p_request_id || data.productId !== request.p_product_id || data.operation !== request.p_operation || data.dispatchEnabled !== false) invalid();
  if (request.p_operation === 'delete') { if (data.product !== null) invalid(); }
  else {
    const row = data.product;
    if (row?.id !== request.p_product_id || !Number.isFinite(Date.parse(row.updated_at))) invalid();
    if (request.p_operation === 'create' && (row.name !== request.p_values.name || row.config?.color !== request.p_values.color || row.config?.clickup_list_id)) invalid();
    if (request.p_operation === 'unlink' && (row.config?.clickup_list_id || row.config?.clickupListId || row.config?.clickup_sync)) invalid();
    if (request.p_operation === 'fields' && JSON.stringify(row.config?.field_options) !== JSON.stringify(request.p_values.catalog)) {
      // JSONB key order is not part of the persisted catalog contract.
      for (const key of ['creativeStructure', 'hookType', 'productionStyle']) {
        const actual = row.config?.field_options?.[key], expected = request.p_values.catalog[key];
        if (!Array.isArray(actual) || actual.length !== expected.length || actual.some((item, index) => item.name !== expected[index].name || item.desc !== expected[index].desc)) invalid();
      }
    }
  }
  return data;
}
