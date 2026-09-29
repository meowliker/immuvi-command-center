import { sameData } from './live-data.js';

export const AD_TYPES = ['Video', 'Photo', 'Carousel', 'UGC', 'VSL', 'AI Style'];
export const FUNNEL_STAGES = ['TOF', 'MOF', 'BOF'];
export const VARIATION_AXES = ['Hook', 'Production Style', 'Music', 'CTA', 'Title', 'Text', 'Thumbnail', 'Full Remake'];
export const TASK_ASSIGNEES_FIELD = { id: '__task_assignees', name: 'Task assignees', type: 'users' };
export const TRACKER_COLUMNS = { formatName: 'format_name', adLink: 'ad_link', driveLink: 'drive_link', adType: 'ad_type',
  funnelStage: 'funnel_stage', status: 'status', angle: 'angle', persona: 'persona' };
export const TRACKER_META_FIELDS = ['creativeStructure', 'hookType', 'productionStyle', 'creativeHypothesis', 'creativeUSP', 'winningElement', 'notes', 'dueDate'];

export function safeCreativeUrl(input) {
  if (!input) return '';
  try { const url = new URL(String(input)); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}

export function trackerDraft(creative = {}) {
  return Object.fromEntries([...Object.keys(TRACKER_COLUMNS), ...TRACKER_META_FIELDS].map((key) => [key,
    String(creative[key] ?? ({ adType: 'Video', funnelStage: 'TOF', status: 'Untested' })[key] ?? ''),
  ]));
}

/** @param {Record<string, string>} draft @param {Record<string, string> | null} original */
export function trackerSaveValues(draft, original = null) {
  const values = {}, meta = {};
  if (!draft.formatName?.trim()) throw new Error('Enter a creative name.');
  for (const key of ['adLink', 'driveLink']) {
    if (draft[key]?.trim() && !safeCreativeUrl(draft[key].trim())) throw new Error(`${key === 'adLink' ? 'Inspiration' : 'Drive'} link must be an HTTP or HTTPS URL.`);
  }
  const due = Date.parse(`${draft.dueDate}T12:00:00Z`);
  if (draft.dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(draft.dueDate) || !Number.isFinite(due) || new Date(due).toISOString().slice(0, 10) !== draft.dueDate)) {
    throw new Error('Enter a valid due date.');
  }
  for (const [key, column] of Object.entries(TRACKER_COLUMNS)) {
    const value = String(draft[key] || '').trim();
    if (!original || value !== String(original[key] || '')) values[column] = value;
  }
  for (const key of TRACKER_META_FIELDS) {
    const value = String(draft[key] || '');
    if (!original || value !== String(original[key] || '')) meta[key] = value;
  }
  if (Object.hasOwn(meta, 'dueDate')) meta._dueDateMs = meta.dueDate ? new Date(`${meta.dueDate}T23:59:59`).getTime() : null;
  if (Object.keys(meta).length) values.meta = meta;
  return values;
}

export function parseWinningFile(input, name = '') {
  let url;
  try { url = new URL(input); } catch { throw new Error('Enter a Google Drive file URL.'); }
  if (!['drive.google.com', 'docs.google.com'].includes(url.hostname) || url.protocol !== 'https:') throw new Error('Enter a Google Drive file URL.');
  if (url.pathname.includes('/folders/')) throw new Error('Choose a file, not a Drive folder.');
  const id = url.pathname.match(/\/d\/([\w-]+)/)?.[1] || url.searchParams.get('id');
  if (!id || !/^[\w-]+$/.test(id)) throw new Error('The Drive URL does not contain a valid file ID.');
  return { id, name: name.trim() || 'Winning file', url: `https://drive.google.com/file/d/${id}/view` };
}

export function customFieldInputValue(field, raw) {
  if (raw === null || raw === undefined) return field.type === 'labels' || field.type === 'users' ? [] : field.type === 'checkbox' ? false : '';
  if (field.type === 'date') { const date = new Date(Number(raw)); return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : ''; }
  if (field.type === 'users') return (Array.isArray(raw) ? raw : []).map((user) => String(user.id ?? user));
  if (field.type === 'labels') return Array.isArray(raw) ? raw.map(String) : [];
  if (field.type === 'drop_down') {
    const option = (field.type_config?.options || []).find((item) => String(item.id) === String(raw) || String(item.orderindex) === String(raw));
    return option ? String(option.id) : String(raw);
  }
  return field.type === 'checkbox' ? raw === true || raw === 'true' : String(raw);
}

export function validateCustomFieldValue(field, value) {
  if (value === '' || value === null) return null;
  const options = field.type_config?.options || [];
  if (field.type === 'drop_down') {
    const option = options.find((item) => String(item.id) === String(value));
    if (!option) throw new Error(`Select an existing option for ${field.name}.`);
    return option.id;
  }
  if (field.type === 'labels') {
    if (!Array.isArray(value) || value.some((id) => !options.some((item) => item.id === id))) throw new Error(`Invalid labels for ${field.name}.`);
    return value;
  }
  if (field.type === 'users') {
    if (!Array.isArray(value) || value.some((id) => !/^\d+$/.test(String(id)))) throw new Error('Invalid ClickUp member.');
    return value.map(Number);
  }
  if (field.type === 'checkbox') { if (typeof value !== 'boolean') throw new Error('Invalid checkbox.'); return value; }
  if (['number', 'currency'].includes(field.type)) { if (!Number.isFinite(Number(value))) throw new Error(`Invalid ${field.name}.`); return Number(value); }
  if (field.type === 'date') {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Date.parse(`${value}T12:00:00Z`);
    if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) throw new Error('Invalid date.');
    return parsed;
  }
  if (field.type === 'url' && !safeCreativeUrl(value)) throw new Error('Enter an HTTP or HTTPS URL.');
  if (!['text', 'short_text', 'url', 'email', 'phone'].includes(field.type)) throw new Error(`${field.name} is read-only in this editor.`);
  return String(value);
}

/** @returns {Record<string, { name: string, type: string, value: any, display?: string }>} */
export function changedCustomFields(fields, drafts, baseline) {
  const changes = {};
  for (const field of fields) {
    if (!Object.hasOwn(drafts, field.id) || sameData(drafts[field.id], baseline[field.id])) continue;
    changes[field.id] = { name: field.name, type: field.type, value: validateCustomFieldValue(field, drafts[field.id]) };
  }
  return changes;
}
