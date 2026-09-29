import { assertQaClickUpList } from '../domain/clickup-sync.js';
import { normalizeActionAd, timestampMs } from '../domain/action-plan.js';
import { readProductRows } from './product-rows.js';

export async function readPlanLinkedDone({ db, clickup, product, listId, input, signal }) {
  assertQaClickUpList(listId);
  const ids = input.adIds;
  if (!Array.isArray(ids) || !ids.length || ids.length > 20 || new Set(ids).size !== ids.length
    || ids.some((id) => typeof id !== 'string' || !id || id.length > 200)) throw new Error('Select 1 to 20 distinct creative IDs.');
  const found = await db.from('ads').select('id,product_id,status,meta,clickup_task_id,updated_at,deleted_at').eq('product_id', product.id).in('id', ids).abortSignal(signal);
  if (found.error || !Array.isArray(found.data)) throw new Error('Could not read product creatives.');
  const tombstones = await readProductRows(db, 'deleted_ads', product.id, signal);
  const rows = [];
  let throttled = false;
  for (const id of ids) {
    signal?.throwIfAborted();
    const ad = found.data.find((row) => row.id === id && row.product_id === product.id);
    const normalized = normalizeActionAd(ad);
    const taskId = normalized.clickupTaskId;
    const row = { adId: id, taskId, version: ad?.updated_at || '', doneAt: null, error: '' };
    if (!ad || normalized.deletedAt || normalized._productBoundaryQuarantined || normalized.status.trim().toLowerCase() !== 'ready to launch'
      || !taskId || tombstones.some((item) => item.id === id || item.clickup_task_id === taskId)) {
      rows.push({ ...row, error: 'Ready-to-launch creative is unavailable.' }); continue;
    }
    try {
      const source = await clickup.getTask(listId, taskId);
      signal?.throwIfAborted();
      if (String(source.id) !== taskId || String(source.list?.id) !== listId) throw new Error('QA task identity check failed.');
      if (!Array.isArray(source.linked_tasks)) throw new Error('ClickUp did not return linked task information.');
      const linkedId = source.linked_tasks.map((link) => String(link?.link_id || '')).find((value) => value && value !== taskId);
      if (linkedId) {
        const linked = await clickup.getTask(listId, linkedId);
        signal?.throwIfAborted();
        if (String(linked.id) !== linkedId || String(linked.list?.id) !== listId) throw new Error('Linked task is outside the QA list.');
        const doneAt = timestampMs(linked.date_done);
        if (linked.date_done != null && linked.date_done !== '' && (doneAt === null || !Number.isFinite(new Date(doneAt).getTime()) || doneAt < 0)) throw new Error('Linked completion date is invalid.');
        row.doneAt = doneAt && doneAt > 0 ? doneAt : null;
      }
      rows.push(row);
    } catch (cause) {
      signal?.throwIfAborted();
      rows.push({ ...row, error: cause instanceof Error ? cause.message : 'Could not read linked completion date.' });
      // Stop a throttled batch instead of making additional requests immediately.
      if (cause?.status === 429 || /rate limit/i.test(row.error || cause?.message || '')) {
        throttled = true;
        for (const remaining of ids.slice(rows.length)) rows.push({ adId: remaining, taskId: '', version: '', doneAt: null, error: 'ClickUp rate limit reached. Retry later.' });
        break;
      }
    }
  }
  return { rows, throttled };
}
