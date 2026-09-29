import { QA_SUPABASE_URL } from '../qa-supabase-env.js';
import { CLEANUP_LIST, validateCleanupRequest, cleanupTaskIds, verifyCleanupPreview, verifyCleanupReceipt } from '../domain/stale-ad-cleanup.js';
import { productClickUpListId } from '../domain/product-config.js';
const failure = (message, definite = false) => Object.assign(new Error(message), { definite });
export async function runStaleAdCleanup({ db, actorId, input, makeClickUp, signal }) {
  validateCleanupRequest(input);
  if (db.supabaseUrl?.replace(/\/$/, '') !== QA_SUPABASE_URL) throw failure('Cleanup is restricted to the approved QA project.', true);
  async function rpc(name, args) {
    const result = await db.rpc(name, args);
    if (result.error) throw failure(/^(P0001|22|23|42501)/.test(result.error.code || '') ? result.error.message : 'Cleanup response is uncertain. Recover the same request.', /^(P0001|22|23|42501)/.test(result.error.code || ''));
    return result.data;
  }
  if (input.operation === 'commit') {
    const saved = await rpc('qa_stale_cleanup_receipt', { p_actor: actorId, p_request: input });
    if (saved) return verifyCleanupReceipt(saved, input);
  }
  const product = await db.from('products').select('*').eq('id', input.productId).single();
  if (product.error || !product.data || productClickUpListId(product.data) !== CLEANUP_LIST) throw failure('Cleanup requires the linked QA test list.', true);
  const clickup = makeClickUp();
  await clickup.inspect(CLEANUP_LIST);
  const ids = cleanupTaskIds(await clickup.tasks(CLEANUP_LIST, { includeArchived: true, requireExplicitEnd: true }));
  signal?.throwIfAborted();
  const result = await rpc(input.operation === 'preview' ? 'qa_stale_cleanup_preview' : 'qa_stale_cleanup_commit', {
    p_actor: actorId, p_product_id: input.productId, p_task_ids: ids, p_product_version: product.data.updated_at,
    ...(input.operation === 'commit' ? { p_request: input } : {}),
  });
  return input.operation === 'preview' ? verifyCleanupPreview(result, input.productId) : verifyCleanupReceipt(result, input);
}
