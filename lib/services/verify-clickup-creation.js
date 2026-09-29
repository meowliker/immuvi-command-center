import { matchesCreation } from '../domain/clickup-creation.js';

const sortedIds = (users=[]) => users.map((u) => String(u?.id ?? u)).sort();
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
function sameField(expected,actual) {
  if (!actual || actual.value === undefined || actual.value === null) return false;
  const value=actual.value;
  if (actual.type==='users') return equal(sortedIds(expected.add),sortedIds(value));
  if (actual.type==='labels') return equal(sortedIds(expected),sortedIds(value));
  if (actual.type==='drop_down') {
    const option=(actual.type_config?.options || []).find((o) => String(o.id)===String(value))
      || (actual.type_config?.options || []).find((o) => String(o.orderindex)===String(value));
    return String(option?.id ?? value)===String(expected);
  }
  if (actual.type==='checkbox') return (value===true || value==='true')===expected;
  if (['number','currency','date'].includes(actual.type)) return Number(value)===Number(expected);
  return String(value)===String(expected);
}
function differences(task,payload) {
  const native={};
  if (task.name!==payload.name) native.name=payload.name;
  if ((task.description || task.text_content || '').replace(/\r\n/g,'\n').trim()!==payload.description.trim()) native.description=payload.description;
  if (payload.status && task.status?.status?.toLowerCase()!==payload.status.toLowerCase()) native.status=payload.status;
  if ((payload.due_date ?? null)!==(task.due_date == null ? null : Number(task.due_date))) native.due_date=payload.due_date ?? null;
  return { native, assignees:!equal(sortedIds(task.assignees),sortedIds(payload.assignees)),
    tags:payload.tags.filter((tag) => !(task.tags || []).some((t) => String(t.name || t).toLowerCase()===tag)),
    fields:payload.custom_fields.filter((field) => !sameField(field.value,task.custom_fields?.find((f) => f.id===field.id))) };
}

export async function verifyClickUpCreation(clickup,job) {
  const { list_id:listId,remote_task_id:taskId,payload }=job;
  let task=await clickup.getTask(listId,taskId);
  if (!matchesCreation(task,job)) throw new Error('Task recovery marker does not match. No local link was changed.');
  const delta=differences(task,payload);
  if (Object.keys(delta.native).length) await clickup.updateTask(listId,taskId,delta.native);
  if (delta.assignees) await clickup.setAssignees(listId,taskId,payload.assignees);
  for (const tag of delta.tags) await clickup.addTag(listId,taskId,tag);
  if (delta.fields.length) {
    const schema=await clickup.inspect(listId);
    for (const pending of delta.fields) {
      const field=schema.fields.find((f) => f.id===pending.id);
      if (!field) throw new Error('A custom field was removed. The existing task is retained for recovery.');
      await clickup.setField(listId,taskId,field,field.type==='users' ? pending.value.add : pending.value);
    }
  }
  if (Object.keys(delta.native).length || delta.assignees || delta.fields.length || delta.tags.length) task=await clickup.getTask(listId,taskId);
  const remaining=differences(task,payload);
  if (!matchesCreation(task,job) || Object.keys(remaining.native).length || remaining.assignees || remaining.fields.length || remaining.tags.length) {
    throw new Error('ClickUp created the task but has not confirmed all fields. Recover its link to finish; do not create another task.');
  }
}
