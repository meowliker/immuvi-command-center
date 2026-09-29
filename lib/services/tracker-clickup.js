import { inferClickUpMappings, clickUpWriteFields } from '../domain/clickup-sync.js';
import { validateCustomFieldValue, TASK_ASSIGNEES_FIELD } from '../domain/tracker-editing.js';
import { matchingClickUpStatus } from '../domain/clickup-statuses.js';

export async function runTrackerClickUp({ db, clickup, product, listId, input }) {
  if (input.operation === 'creative-schema') {
    const schema = await clickup.inspect(listId);
    const members = await clickup.members(listId);
    return { ...schema, fields: [TASK_ASSIGNEES_FIELD, ...schema.fields], members, mappings: inferClickUpMappings(schema.fields) };
  }
  const result = await db.from('ads').select('*').eq('product_id', product.id).eq('id', input.adId).maybeSingle();
  if (result.error || !result.data) throw new Error('Creative is not available for this product.');
  const ad = result.data;
  const taskId = ad.clickup_task_id || ad.meta?._clickupId || ad.meta?.clickupTaskId;
  if (!taskId) throw new Error('This creative has no linked ClickUp task.');
  if (input.actionId && input.operation === 'push-creative') {
    const card = await db.from('manual_actions').select('payload').eq('product_id', product.id).eq('id', input.actionId).maybeSingle();
    const payload = card.data?.payload;
    const sourceId = payload?.sourceAdId || payload?.adId || payload?._sourceAdId;
    const linkedTask = payload?._clickupId || payload?.clickupTaskId;
    if (card.error || !payload || sourceId !== ad.id || (linkedTask && linkedTask !== taskId)) throw new Error('Action Plan source or task identity changed. Refresh before pushing.');
  }
  if (input.operation === 'delete-creative-task') {
    if (!ad.deleted_at) throw new Error('Delete the creative locally before deleting its ClickUp task.');
    await clickup.deleteTask(listId, taskId);
    return { deleted: true };
  }
  if (ad.deleted_at) throw new Error('Creative was deleted.');
  if (ad.meta?._productBoundaryQuarantined) throw new Error('Creative is quarantined for product-boundary review.');
  if (input.operation === 'winner-comment') {
    const winner = await db.from('task_video_winners').select('*').eq('ad_id', ad.id).eq('drive_file_id', input.fileId).maybeSingle();
    if (winner.error || !winner.data) throw new Error('Winning file is no longer available.');
    await clickup.comment(listId, taskId, `Winner file: ${winner.data.file_name} - ${winner.data.web_view_url}`);
    return { commented: true };
  }
  const schema = await clickup.inspect(listId);
  const mappings = inferClickUpMappings(schema.fields);
  const pending = ad.meta?._trackerPending || {};
  const sent = {}, failed = [];
  // Field writes are independent and idempotent; acknowledge only successful values.
  for (const [key, value] of Object.entries(pending)) {
    try {
      if (key === 'format_name' || key === 'status' || key === 'dueDate') {
        const field = key === 'format_name' ? 'name' : key === 'dueDate' ? 'due_date' : 'status';
        const remoteValue = key === 'dueDate' ? (value ? ad.meta._dueDateMs : null) : key === 'status' ? matchingClickUpStatus(value, schema.list?.statuses) : value;
        await clickup.updateTask(listId, taskId, { [field]: remoteValue });
      } else if (key === `custom:${TASK_ASSIGNEES_FIELD.id}`) {
        await clickup.setAssignees(listId, taskId, validateCustomFieldValue(TASK_ASSIGNEES_FIELD, value));
      } else if (key === 'creativeHypothesis') {
        const task = await clickup.getTask(listId, taskId);
        const line = `Creative Hypothesis: ${value}`;
        const description = /Creative Hypothesis:[^\n]*/i.test(task.description || '')
          ? task.description.replace(/Creative Hypothesis:[^\n]*/i, () => line)
          : `${line}\n\n${task.description || ''}`;
        await clickup.updateTask(listId, taskId, { description });
      } else {
        const custom = key.startsWith('custom:');
        const id = custom ? key.slice(7) : mappings[key];
        const field = schema.fields.find((item) => item.id === id)
          || (!id && !custom && ['notes', 'winningElement'].includes(key) ? schema.fields.find((item) => item.name.toLowerCase() === (key === 'notes' ? 'notes' : 'winning element')) : null);
        if (!field) throw new Error('No field mapping in this test list.');
        const targets = !custom && ['angle', 'persona'].includes(key) ? clickUpWriteFields(key, schema.fields, mappings) : [field];
        for (const target of targets) {
          let mapped = value;
          if (!custom && target.type === 'drop_down' && value !== '' && value !== null) {
            const option = (target.type_config?.options || []).find((item) => item.name?.trim().toLowerCase() === String(value).trim().toLowerCase());
            if (!option) throw new Error(`Create the matching option in ${target.name}, then retry. This edit remains pending.`);
            mapped = option.id;
          }
          await clickup.setField(listId, taskId, target, validateCustomFieldValue(target, mapped));
        }
      }
      sent[key] = value;
    } catch (error) { failed.push({ field: key, error: error.message }); }
  }
  if (Object.keys(sent).length) {
    const ack = await db.rpc('qa_tracker_ack_push', { p_product_id: product.id, p_ad_id: ad.id, p_sent: sent });
    if (ack.error) throw new Error('ClickUp accepted changes, but QA could not record their completion. Refresh before retrying.');
  }
  return { pushed: Object.keys(sent).length, failed };
}
