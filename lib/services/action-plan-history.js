export const PLAN_HISTORY_PAGE_SIZE = 40;
const quote = (value) => `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
const validId = (value) => typeof value === 'string' && value.length > 0 && value.length <= 200 && !/[\x00-\x1f]/.test(value);

/**
 * @typedef {{id: string, product_id: string, event_type: string, action_id?: string|null, clickup_task_id?: string|null, field_name?: string|null, old_value?: string|null, new_value?: string|null, actor?: string|null, source?: string, metadata?: Record<string, unknown>, created_at: string}} HistoryRow
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} productId
 * @param {{actionId: string, taskId: string, adId: string}|null} target
 * @param {{id: string, created_at: string}|null} cursor
 * @param {AbortSignal} [signal]
 * @returns {Promise<{rows: HistoryRow[], hasMore: boolean, cursor: {id: string, created_at: string}|null}>}
 */
export async function readPlanHistoryPage(db, productId, target = null, cursor = null, signal) {
  if (!validId(productId)) throw new Error('Select a product for history.');
  const clauses = [];
  if (target) {
    if (![target.actionId, target.taskId, target.adId].some(validId) || [target.actionId, target.taskId, target.adId].some((id) => id && !validId(id))) throw new Error('Invalid history target.');
    const matches = target.actionId ? [`action_id.eq.${quote(target.actionId)}`] : [];
    if (target.taskId) matches.push(`clickup_task_id.eq.${quote(target.taskId)}`);
    if (target.adId) matches.push(`metadata->>ad_id.eq.${quote(target.adId)}`);
    clauses.push(`or(${matches.join(',')})`);
  }
  if (cursor) {
    if (!validId(cursor.id) || typeof cursor.created_at !== 'string' || !Number.isFinite(Date.parse(cursor.created_at))) throw new Error('Invalid history cursor.');
    clauses.push(`or(created_at.lt.${quote(cursor.created_at)},and(created_at.eq.${quote(cursor.created_at)},id.lt.${quote(cursor.id)}))`);
  }
  let query = db.from('activity_events').select('id,product_id,event_type,action_id,clickup_task_id,field_name,old_value,new_value,actor,source,metadata,created_at')
    .eq('product_id', productId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PLAN_HISTORY_PAGE_SIZE + 1);
  if (clauses.length) query = query.or(`and(${clauses.join(',')})`);
  const result = await query.abortSignal(signal);
  signal?.throwIfAborted();
  if (result.error) throw new Error('Could not load activity history. Try again.');
  if (!Array.isArray(result.data) || result.data.some((row) => !validId(row.id) || row.product_id !== productId
    || typeof row.created_at !== 'string' || !Number.isFinite(Date.parse(row.created_at))
    || (target && row.action_id !== target.actionId && !(target.taskId && row.clickup_task_id === target.taskId) && !(target.adId && row.metadata?.ad_id === target.adId)))) {
    throw new Error('History response is incomplete or outside this task.');
  }
  const rows = result.data.slice(0, PLAN_HISTORY_PAGE_SIZE);
  const last = rows.at(-1);
  if (cursor && rows.some((row) => row.id === cursor.id)) throw new Error('History pagination did not advance.');
  if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error('History response contains duplicate events.');
  return { rows, hasMore: result.data.length > PLAN_HISTORY_PAGE_SIZE, cursor: last ? { id: last.id, created_at: last.created_at } : cursor };
}
