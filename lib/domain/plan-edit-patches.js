import { sameData } from './live-data.js';
import { explicitPlanSource } from './action-plan-editing.js';

const displayKeys = { format_name: 'title', angle: 'angle', persona: 'persona', ad_type: 'adType', funnel_stage: 'funnelStage', ad_link: 'adLink', drive_link: 'driveLink' };
export const planEditKey = action => JSON.stringify([action.display.productId, action.display.linkedAdId || action.display.dbId]);

export function applyPlanEdit(action, edit) {
  const display = { ...action.display }, meta = { ...action.linkedAdMeta };
  if (edit.kind === 'status') { display.status = edit.value; display.lastStatusChangeAt = edit.changedAt; }
  else if (edit.kind === 'due') display.dueDate = edit.value;
  else if (edit.kind === 'creative') {
    for (const [key, value] of Object.entries(edit.values)) {
      if (key === 'meta') Object.assign(meta, value);
      else if (displayKeys[key]) display[displayKeys[key]] = value;
    }
  } else if (edit.kind === 'fields') {
    meta._customFields = { ...meta._customFields };
    meta._customFieldsRaw = { ...meta._customFieldsRaw };
    for (const [id, change] of Object.entries(edit.values)) {
      if (id === '__task_assignees') meta.assignees = change.value;
      meta._customFieldsRaw[change.name.toLowerCase()] = change.value;
      meta._customFields[change.name.toLowerCase()] = change.display;
    }
  }
  return { ...action, display, linkedAdMeta: meta };
}

function editedValues(action, edit) {
  if (edit.kind === 'status') return action.display.status;
  if (edit.kind === 'due') return action.display.dueDate || '';
  if (edit.kind === 'fields') return Object.entries(edit.values).map(([id, change]) =>
    id === '__task_assignees' ? action.linkedAdMeta.assignees ?? [] : action.linkedAdMeta._customFieldsRaw?.[change.name.toLowerCase()] ?? null);
  return Object.entries(edit.values).map(([key, value]) => key === 'meta'
    ? Object.keys(value).map(name => action.linkedAdMeta[name] ?? '')
    : action.display[displayKeys[key]] ?? '');
}

// Rebase only untouched target fields. Row-version checks still protect the RPC itself.
export function rebasePlanEdit(expected, current, edit) {
  if (!current || expected.display.productId !== current.display.productId
    || expected.display.dbId !== current.display.dbId
    || expected.display.linkedAdId !== current.display.linkedAdId
    || expected.display.clickupTaskId !== current.display.clickupTaskId
    || explicitPlanSource(expected) !== explicitPlanSource(current)) throw new Error('Task identity changed. Refresh before editing.');
  if (!sameData(editedValues(expected, edit), editedValues(current, edit))) throw new Error('This field changed elsewhere. Your edit was not applied; review its current value and try again.');
  return current;
}
