import { QA_SUPABASE_URL } from '../qa-supabase-env.js';

const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const revision = /^[\da-f]{32}$/;
function reject(message) { throw Object.assign(new Error(message), { definite: true }); }
function assertQa(db) { if (db.supabaseUrl?.replace(/\/$/, '') !== QA_SUPABASE_URL) reject('User access changes are restricted to QA.'); }
export function validateAdminAccessRequest(request) {
  if (!request || !uuid.test(request.p_request_id) || !uuid.test(request.p_user_id) || !revision.test(request.p_revision)
    || !['products', 'role'].includes(request.p_operation) || !request.p_values || typeof request.p_values !== 'object') reject('Invalid user access request.');
  const values = request.p_values;
  if (request.p_operation === 'role') {
    if (!['member', 'admin'].includes(values.role) || Object.keys(values).join() !== 'role') reject('Invalid role.');
  } else if (!Array.isArray(values.productIds) || values.productIds.length > 1000 || Object.keys(values).join() !== 'productIds'
    || values.productIds.some((id) => typeof id !== 'string' || !id.trim() || id !== id.trim() || id.length > 200)
    || new Set(values.productIds).size !== values.productIds.length) reject('Invalid product assignments.');
  return request;
}
function validUser(row) {
  return row && uuid.test(row.id) && revision.test(row.access_revision) && typeof row.email === 'string'
    && ['admin', 'member'].includes(row.role) && typeof row.is_active === 'boolean' && typeof row.must_change_password === 'boolean'
    && Array.isArray(row.product_ids) && row.product_ids.every((id) => typeof id === 'string' && id.length > 0)
    && new Set(row.product_ids).size === row.product_ids.length;
}
export async function readAdminUsers(db, signal) {
  assertQa(db);
  const rows = []; let after = null;
  for (;;) {
    const { data, error } = await db.rpc('qa_admin_users_page', { p_after: after }).abortSignal(signal);
    if (error) throw new Error(error.message || 'Users could not be loaded.');
    if (!Array.isArray(data) || data.length > 500 || data.some((row, index) => !validUser(row) || row.id <= (index ? data[index - 1].id : after || ''))) throw new Error('User list could not be verified.');
    rows.push(...data);
    if (data.length < 500) return rows;
    after = data.at(-1).id;
  }
}
export async function mutateAdminAccess(db, request) {
  assertQa(db); validateAdminAccessRequest(request);
  const { data, error } = await db.rpc('qa_admin_access_mutate', request);
  if (error) throw Object.assign(new Error(error.message || 'User access save failed.'), { definite: /^(P0001|22|23|42501)/.test(error.code || '') });
  const row = data?.user;
  if (data?.requestId !== request.p_request_id || data.userId !== request.p_user_id || data.operation !== request.p_operation
    || data.dispatchEnabled !== false || !validUser(row) || row.id !== request.p_user_id
    || (request.p_operation === 'role' && row.role !== request.p_values.role)
    || (request.p_operation === 'products' && (row.role !== 'member' || JSON.stringify([...row.product_ids].sort()) !== JSON.stringify([...request.p_values.productIds].sort())))) {
    throw new Error('User access save could not be verified. Retry the pending request.');
  }
  return data;
}
