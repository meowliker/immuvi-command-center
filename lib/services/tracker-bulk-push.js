import { assertQaClickUpList, inferClickUpMappings, clickUpWriteFields } from '../domain/clickup-sync.js';
import { normalizeCreativeRow } from '../domain/creative-tracker.js';
import { planLifecycleRows } from '../domain/action-plan-visibility.js';
import { trackerBulkValues } from '../domain/tracker-bulk-push.js';
import { validateCustomFieldValue } from '../domain/tracker-editing.js';
import { readProductRows } from './product-rows.js';

export async function pushAllCreativeFields({ db, clickup, product, listId, input, signal }) {
  assertQaClickUpList(listId);
  signal?.throwIfAborted();
  if (typeof input.adId !== 'string' || !input.adId || typeof input.expectedUpdatedAt !== 'string' || !input.expectedUpdatedAt || typeof input.expectedTaskId !== 'string' || !input.expectedTaskId) {
    throw new Error('A saved creative version and linked task are required.');
  }
  const result = await db.from('ads').select('*').eq('product_id', product.id).eq('id', input.adId).maybeSingle();
  if (result.error || !result.data || result.data.product_id !== product.id) throw new Error('Creative is unavailable in this product.');
  const row = result.data, creative = normalizeCreativeRow(row);
  if (creative.version !== input.expectedUpdatedAt || creative.clickupTaskId !== input.expectedTaskId) throw new Error('Creative or ClickUp link changed. Refresh before pushing again.');
  const tombstones = await readProductRows(db, 'deleted_ads', product.id, signal, 'id,product_id,clickup_task_id');
  if (!planLifecycleRows([], [row], tombstones).ads.length) throw new Error('Creative is deleted or quarantined.');
  const values = trackerBulkValues(creative);
  const schema = await clickup.inspect(listId);
  const mappings = inferClickUpMappings(schema.fields);
  let pushed = 0;
  const failed = [], acknowledged = {};
  for (const [key, value] of Object.entries(values)) {
    const mappingKey = key === 'funnelStage' ? 'funnel_stage' : key;
    const fields = clickUpWriteFields(mappingKey, schema.fields, mappings);
    if (!fields.length) { failed.push({ field: key, error: 'No field mapping in this test list.' }); continue; }
    const failuresBefore = failed.length;
    for (const field of fields) {
      signal?.throwIfAborted();
      try {
        let mapped = value;
        if (field.type === 'drop_down') {
          const option = (field.type_config?.options || []).find((item) => item.name?.trim().toLowerCase() === value.trim().toLowerCase());
          if (!option) throw new Error('Create the matching dropdown option in ClickUp, then push again.');
          mapped = option.id;
        }
        await clickup.setField(listId, creative.clickupTaskId, field, validateCustomFieldValue(field, mapped));
        pushed++;
      } catch (error) {
        signal?.throwIfAborted();
        failed.push({ field: field.name || key, error: error instanceof Error ? error.message : 'Field push failed.' });
      }
    }
    if (failed.length === failuresBefore && row.meta?._trackerPending?.[mappingKey] === value) acknowledged[mappingKey] = value;
  }
  if (Object.keys(acknowledged).length) {
    signal?.throwIfAborted();
    const ack = await db.rpc('qa_tracker_ack_push', { p_product_id: product.id, p_ad_id: row.id, p_sent: acknowledged });
    if (ack.error) throw new Error('ClickUp accepted fields, but QA could not record completion. Refresh before retrying.');
  }
  return { adId: row.id, taskId: creative.clickupTaskId, pushed, failed };
}
