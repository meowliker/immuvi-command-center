const { randomUUID } = require('node:crypto');
module.exports = function (data, input, control) {
  (control.cleanupCalls ||= []).push(structuredClone(input));
  const receipts = control.cleanupReceipts ||= new Map(), previews = control.cleanupPreviews ||= new Map();
  const fail = (error, definite = true) => ({ error, definite });
  const saved = receipts.get(input.requestId);
  if (saved) return JSON.stringify(saved.request) === JSON.stringify(input) ? structuredClone(saved.result) : fail('Cleanup request identity conflicts');
  control.cleanupRemoteReads = (control.cleanupRemoteReads || 0) + 1;
  if (control.cleanupFailure) return fail('A complete nonempty ClickUp snapshot is required. Cleanup is blocked.', false);
  const product = data.products.find((row) => row.id === input.productId);
  if (!product || product.config?.clickup_list_id !== '1301130000002447') return fail('Cleanup requires the linked QA test list.');
  const snapshot = () => JSON.stringify([data.ads,data.manual_actions,data.matrix_cells,product]);
  if (input.operation === 'preview') {
    const previewId = randomUUID();
    const result = { previewId, productId: product.id, productName: product.name, listId: '1301130000002447', remoteCount: 101, expiresAt: new Date(Date.now() + 600000).toISOString(),
      candidates: data.ads.filter((row) => row.id === 'qa-stale-browser' && !row.deleted_at).map((row) => ({ id: row.id, name: row.format_name, taskId: row.clickup_task_id })),
      protected: { 'referenced work': 1 }, dispatchEnabled: false };
    previews.set(previewId, { result, snapshot: snapshot() }); return result;
  }
  const preview = previews.get(input.previewId);
  if (!preview || input.confirmName !== product.name || preview.snapshot !== snapshot()) return fail('Product work changed since preview. Review a new preview.');
  for (const item of preview.result.candidates) {
    const row = data.ads.find((row) => row.id === item.id); row.deleted_at = new Date().toISOString();
    data.deleted_ads.push({ id: row.id, product_id: row.product_id, clickup_task_id: row.clickup_task_id });
  }
  control.cleanupCommits = (control.cleanupCommits || 0) + 1;
  const result = { requestId: input.requestId, previewId: input.previewId, productId: product.id, deletedIds: preview.result.candidates.map((row) => row.id), dispatchEnabled: false };
  receipts.set(input.requestId, { request: input, result }); return structuredClone(result);
};
