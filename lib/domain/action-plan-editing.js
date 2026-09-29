import { trackerDraft, trackerSaveValues } from './tracker-editing.js';

/** @returns {Record<string, unknown>} */
export function planCreativeValues(creative, draft) {
  const original = trackerDraft(creative);
  // Status/due changes retain their dedicated milestone-aware workflow.
  return trackerSaveValues({ ...draft, status: original.status, dueDate: original.dueDate }, original);
}

export function planTitleValues(title) {
  const value = title.trim();
  if (!value || value.length > 500) throw new Error('Enter a task name of 1 to 500 characters.');
  return { format_name: value };
}

export function explicitPlanSource(action) {
  return String(action.payload.sourceAdId || action.payload.adId || action.payload._sourceAdId || '');
}

export function canEditPlanTitle(action) {
  const source = explicitPlanSource(action);
  return action.display.linkedAdId ? source === action.display.linkedAdId : !source && !action.display.clickupTaskId;
}
