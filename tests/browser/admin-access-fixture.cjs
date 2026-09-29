const { createHash } = require('node:crypto');
function snapshot(row) {
  return { ...row, access_revision: createHash('md5').update(JSON.stringify([row.role, row.is_active, row.must_change_password, row.product_ids, row.accessGeneration || 0])).digest('hex') };
}
exports.page = (data, after) => data.profiles_with_products.filter((row) => !after || row.id > after).sort((a, b) => a.id.localeCompare(b.id)).slice(0, 500).map(snapshot);
exports.mutate = (data, input, control) => {
  (control.adminAccessCalls ||= []).push(structuredClone(input));
  const receipts = control.adminAccessReceipts ||= new Map();
  const previous = receipts.get(input.p_request_id);
  const error = (message) => ({ code: 'P0001', message });
  if (previous) return JSON.stringify(previous.input) === JSON.stringify(input) ? structuredClone(previous.result) : error('User request identity conflicts');
  const row = data.profiles_with_products.find((item) => item.id === input.p_user_id);
  if (!row || snapshot(row).access_revision !== input.p_revision) return error('User access changed. Review the latest access before saving.');
  if (input.p_operation === 'products') {
    if (input.p_values.productIds.some((id) => !data.products.some((product) => product.id === id))) return error('An assigned product is unavailable. Refresh and review.');
    row.product_ids = [...input.p_values.productIds].sort();
  } else row.role = input.p_values.role;
  row.accessGeneration = (row.accessGeneration || 0) + 1;
  const result = { requestId: input.p_request_id, userId: row.id, operation: input.p_operation, user: snapshot(row), dispatchEnabled: false };
  receipts.set(input.p_request_id, { input: structuredClone(input), result: structuredClone(result) });
  return result;
};
