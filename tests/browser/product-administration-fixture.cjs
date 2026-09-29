const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
function preview(data, id) {
  const tables = Object.fromEntries(Object.entries(data).map(([table, rows]) => [table, rows.filter((row) => row.product_id === id)]));
  return { productId: id, counts: Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rows.length])),
    revision: createHash('md5').update(JSON.stringify(tables)).digest('hex'),
    blocked: tables.inspiration_queue.some((row) => ['pending', 'claimed', 'processing'].includes(row.status)) };
}
function mutate(data, request, control) {
  (control.productAdminCalls ||= []).push(structuredClone(request));
  const receipts = control.productAdminReceipts ||= new Map();
  if (receipts.has(request.p_request_id)) { assert.deepEqual(receipts.get(request.p_request_id).request, request); return structuredClone(receipts.get(request.p_request_id).result); }
  const { p_operation: operation, p_product_id: id, p_values: values } = request;
  let row = data.products.find((row) => row.id === id);
  const reject = (message) => ({ code: 'P0001', message });
  if (operation !== 'create' && (!row || (row.updated_at || null) !== request.p_expected_updated_at)) return reject('Product changed or was deleted. Refresh and review before retrying.');
  if (['unlink', 'delete'].includes(operation) && values.confirmName !== row.name) return reject('Confirm the exact product name');
  if (operation === 'create') {
    if (data.products.some((row) => row.name.toLowerCase() === values.name.toLowerCase())) return reject('Product name already exists');
    row = { id, name: values.name, config: { color: values.color, ins_prefix: values.name.trim().split(/\s+/).map((word)=>word[0].toUpperCase()).join('').slice(0,3) || 'INS' } }; data.products.push(row);
  } else if (operation === 'fields') row.config.field_options = structuredClone(values.catalog);
  else if (operation === 'unlink') {
    for (const key of ['clickup_list_id','clickup_list_name','clickupListId','clickupListName','clickup_sync','last_synced_at_ms','last_synced_count']) delete row.config[key];
  } else {
    const manifest = preview(data, id);
    if (manifest.blocked) return reject('Product has queued or running work. Resolve it before deleting.');
    if (manifest.revision !== values.revision) return reject('Product data changed since preview. Review a new preview.');
    for (const [table, rows] of Object.entries(data)) data[table] = rows.filter((item) => item.product_id !== id && !(table === 'products' && item.id === id));
  }
  row.updated_at = new Date(Date.now() + (control.productAdminSequence = (control.productAdminSequence || 0) + 1)).toISOString();
  const result = { requestId: request.p_request_id, productId: id, operation, product: operation === 'delete' ? null : structuredClone(row), dispatchEnabled: false };
  receipts.set(request.p_request_id, { request: structuredClone(request), result: structuredClone(result) }); return result;
}
module.exports = { preview, mutate };
