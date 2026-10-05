import { sameData } from './live-data.js';
import { descriptionFields, resolvePlanCellIdentity } from './action-plan-cell.js';
import { safeCreativeUrl } from './tracker-editing.js';
import { normalizeClickUpDescription, clickUpHypothesis } from './clickup-description.js';
import { assertQaProductList, qaDestinationForList } from './qa-destinations.js';

export const QA_CLICKUP_LIST_ID = '1301130000002447';
export const CLICKUP_FIELDS = {
  angle: ['angle tag', 'angle', 'angles', 'ad angle'],
  persona: ['persona tag', 'persona', 'personas', 'target persona', 'audience'],
  ad_link: ['inspiration link', 'inspo link', 'ad link', 'adlink', 'ad url', 'creative link', 'reference link'],
  drive_link: ['drive link', 'google drive', 'gdrive', 'production link', 'google drive link', 'drive'],
  ad_type: ['photo/video', 'ad type', 'adtype', 'format type'],
  funnel_stage: ['funnel type', 'funnel', 'funnel stage', 'funnelstage', 'stage'],
  parent_ad_id: ['parent ad', 'parentad', 'parent task'],
  variation_number: ['variation number', 'variationnumber', 'variation #'],
  creativeStructure: ['creative structure', 'structure', 'creative format', 'format category'],
  hookType: ['hook type', 'hook', 'hooktype', 'hook style'],
  productionStyle: ['production style', 'productionstyle', 'production type', 'style'],
  creativeUSP: ['creative usp', 'usp', 'unique selling point'],
};

export function assertQaClickUpList(listId, productId) {
  if (!qaDestinationForList(listId)) throw new Error('QA ClickUp is restricted to approved test lists.');
  if (productId !== undefined) assertQaProductList(productId, listId);
}

export function clickUpStatus(status) {
  const raw = String(status || '').trim();
  const key = raw.toLowerCase();
  return ({ 'in progress': 'In Production', 'in review': 'Testing', ready: 'Ready to Launch',
    'mild-winner': 'Mild Winner', 'ready to launch': 'Ready to Launch', closed: 'Loser', done: 'Complete', 'to do': 'Untested', open: 'Untested',
  })[key] || raw.replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Untested';
}

export function clickUpDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(/^\d+$/.test(String(value)) ? Number(value) : value);
  if (!Number.isFinite(date.getTime())) throw new Error('ClickUp returned an invalid date.');
  return date.toISOString();
}

export function clickUpFieldValue(field) {
  const value = field?.value;
  if (value === undefined || value === null) return '';
  const options = field.type_config?.options || [];
  if (field.type === 'drop_down') {
    const option = options.find((item) => String(item.id) === String(value))
      || options.find((item) => String(item.orderindex) === String(value));
    return option?.name || option?.label || options[Number(value)]?.name || String(value);
  }
  if (field.type === 'labels') return (Array.isArray(value) ? value : [value]).map((id) => {
    const option = options.find((item) => String(item.id) === String(id));
    return option?.label || option?.name || String(id);
  }).join(', ');
  if (field.type === 'users') return (Array.isArray(value) ? value : []).map((user) => user.username || user.email || user.id || user).join(', ');
  if (field.type === 'date') return clickUpDate(value)?.slice(0, 10) || '';
  if (field.type === 'checkbox') return value === true || value === 'true' ? 'Yes' : 'No';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export function inferClickUpMappings(fields) {
  return Object.fromEntries(Object.entries(CLICKUP_FIELDS).map(([key, names]) => [key,
    names.map((name) => fields.filter((field) => field.name?.trim().toLowerCase() === name)
      .sort((a, b) => (b.type_config?.options || []).filter(option => option.name !== '\u2014').length
        - (a.type_config?.options || []).filter(option => option.name !== '\u2014').length)[0]?.id).find(Boolean) || '',
  ]));
}

export function clickUpWriteFields(key, fields, mappings = inferClickUpMappings(fields)) {
  const primary = fields.find((field) => field.id === mappings[key]);
  if (!primary) return [];
  if (!['angle', 'persona'].includes(key) || !['text', 'short_text'].includes(primary.type)) return [primary];
  const dropdowns = fields.filter((field) => field.type === 'drop_down');
  const secondaryId = inferClickUpMappings(dropdowns)[key];
  const secondary = dropdowns.find((field) => field.id === secondaryId);
  return secondary ? [primary, secondary] : [primary];
}

export function validateClickUpMappings(mapping, fields) {
  const valid = new Set(fields.map((field) => field.id));
  for (const [key, id] of Object.entries(mapping || {})) {
    if (!(key in CLICKUP_FIELDS) || typeof id !== 'string' || (id && !valid.has(id))) {
      throw new Error('Field configuration no longer matches this ClickUp list. Reload its fields.');
    }
  }
  return mapping || {};
}

export function taskToCreativePatch(task, mapping, listId) {
  if (!task?.id || String(task.list?.id || task.list_id || '') !== listId) {
    throw new Error('ClickUp returned a task outside the linked test list. Nothing was imported.');
  }
  const fields = task.custom_fields || [];
  const patch = { format_name: String(task.name || ''), status: clickUpStatus(task.status?.status), clickup_task_id: String(task.id) };
  const meta = { _clickupId: String(task.id), _clickupUrl: `https://app.clickup.com/t/${task.id}`,
    _clickupListId: listId, _clickupStatus: task.status?.status || '',
    _clickupUpdatedAt: clickUpDate(task.date_updated), _clickupDescription: normalizeClickUpDescription(task.description || task.text_content || ''), description: normalizeClickUpDescription(task.description || task.text_content || ''),
    _customFields: {}, _customFieldsRaw: {}, _tags: (task.tags || []).map((tag) => tag.name || tag),
  };
  for (const [key, id] of Object.entries(mapping)) {
    if (!id) continue;
    const field = fields.find((item) => item.id === id);
    // An absent field is not evidence that its locally saved value was cleared.
    if (!field) continue;
    const value = clickUpFieldValue(field);
    if (key === 'variation_number') {
      if (value !== '' && !/^\d+$/.test(value)) throw new Error('ClickUp variation number must be a non-negative integer.');
      patch[key] = value === '' ? null : Number(value);
    }
    else if (['angle', 'persona', 'ad_link', 'drive_link', 'ad_type', 'funnel_stage', 'parent_ad_id'].includes(key)) patch[key] = value;
    else meta[key] = value;
  }
  for (const field of fields) {
    const key = String(field.name || '').trim().toLowerCase();
    if (!key) continue;
    meta._customFields[key] = clickUpFieldValue(field);
    meta._customFieldsRaw[key] = field.value ?? null;
  }
  // Photo/Video can be coarser than the app's creative classification. Preserve
  // our explicit projection until the remote media value actually changes.
  if (/^IMMUVI_(PRODUCTION|QA)_JOB:[\w-]+\s*$/m.test(meta.description)) {
    const labels=descriptionFields(meta.description), original=labels.get('ad type'), medium=labels.get('clickup media type');
    if (['AI Style','UGC','VSL','Carousel'].includes(original) && ['Photo','Video'].includes(medium)
      && patch.ad_type===medium)patch.ad_type=original;
  }
  // Legacy tags are authoritative when populated; otherwise use dropdowns or
  // the labeled brief. Missing fields alone must not erase saved local data.
  const cell = resolvePlanCellIdentity({ description: meta.description, _customFields: meta._customFields }, null);
  for (const key of ['angle', 'persona']) {
    const present = fields.filter(field => CLICKUP_FIELDS[key].includes(field.name?.trim().toLowerCase()));
    const customValue = present.map(clickUpFieldValue).find(Boolean);
    if (!patch[key] && customValue) patch[key] = customValue;
    else if (!patch[key] && !present.length && cell[key]) patch[key] = cell[key];
  }
  if (!patch.ad_link) {
    const labels = descriptionFields(meta.description);
    for (const key of ['source ad', 'inspiration link', 'inspo link', 'ad link', 'reference link', 'reference creative', 'inspiration']) {
      const value = labels.get(key) || '';
      const url = safeCreativeUrl(value.match(/\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/)?.[1] || value);
      if (url) { patch.ad_link = url; break; }
    }
  }
  if (Array.isArray(task.assignees)) {
    meta.assignees = task.assignees.map(({ id, username, email }) => ({ id, username, email }));
    meta._customFields['task assignees'] = task.assignees.map((user) => user.username || user.email || user.id).join(', ');
    meta._customFieldsRaw['task assignees'] = task.assignees;
    if (!Object.hasOwn(meta._customFieldsRaw, 'editor')) {
      meta._customFields.editor = meta._customFields['task assignees'];
      meta._customFieldsRaw.editor = task.assignees;
    }
  }
  if (Object.hasOwn(task, 'due_date')) {
    const date = clickUpDate(task.due_date);
    meta.dueDate = date?.slice(0, 10) || '';
    meta._dueDateMs = date ? new Date(date).getTime() : null;
  }
  if (meta._tags.some((tag) => String(tag).toLowerCase() === 'production')) meta.taskType = 'production';
  const hypothesis = clickUpHypothesis(meta.description);
  if (hypothesis) meta.creativeHypothesis = hypothesis;
  return { ...patch, meta };
}

export function buildClickUpImport({ productId, listId, tasks, ads, actions, tombstones, mappings, now = Date.now(), environment = 'qa' }) {
  if (environment === 'qa') assertQaClickUpList(listId, productId);
  else if (environment !== 'production' || listId !== '901613447211' || productId !== 'prod-1778009469915') throw new Error('Production import destination mismatch.');
  const deleted = new Set(tombstones.flatMap((row) => [row.id, row.clickup_task_id]).filter(Boolean));
  const byTask = new Map();
  const byId = new Map(ads.map((ad) => [ad.id, ad]));
  for (const row of [...ads, ...actions, ...tombstones]) {
    if (row.product_id !== productId) throw new Error('Cross-product sync data was rejected.');
  }
  const taskIdOf = (row) => row.clickup_task_id || row.meta?._clickupId || row.meta?.clickupTaskId;
  for (const ad of ads) {
    const id = taskIdOf(ad);
    if (!id) continue;
    if (byTask.has(id)) throw new Error(`Duplicate local ClickUp link ${id}. Resolve it before syncing.`);
    byTask.set(id, ad);
    if (ad.deleted_at) deleted.add(id);
  }
  // Repair only unambiguous Action Plan links, never repoint an already-linked creative.
  for (const action of actions) {
    const payload = action.payload || {};
    const taskId = payload._clickupId || payload.clickupTaskId;
    const source = byId.get(payload.sourceAdId || payload._sourceAdId || payload.adId);
    if (!taskId || byTask.has(taskId) || !source) continue;
    if (taskIdOf(source) && taskIdOf(source) !== taskId) throw new Error('Conflicting Action Plan source link. Sync stopped.');
    byTask.set(taskId, source);
  }
  const adChanges = [], actionChanges = [], seen = new Set(), changedByTask = new Map();
  let skipped = 0;
  for (const task of tasks) {
    if (seen.has(task.id)) continue;
    seen.add(task.id);
    // A remotely created task can arrive before its local link commits. Keep
    // the durable workflow authoritative instead of importing a second creative.
    const marker = environment === 'production' ? /^IMMUVI_(PRODUCTION|QA)_JOB:[0-9a-f-]{36}\s*$/im : /^IMMUVI_QA_JOB:[0-9a-f-]{36}\s*$/im;
    if (marker.test(task.description || task.text_content || '') && !byTask.has(String(task.id))) { skipped++; continue; }
    const patch = taskToCreativePatch(task, mappings, listId);
    const existing = byTask.get(String(task.id));
    const id = existing?.id || `cu:${productId}:${task.id}`;
    if (deleted.has(String(task.id)) || deleted.has(id) || existing?.deleted_at) { skipped++; continue; }
    if (existing?.meta?._productBoundaryQuarantined) { skipped++; continue; }
    if (existing?.meta?._clickupUpdatedAt && patch.meta._clickupUpdatedAt &&
        new Date(existing.meta._clickupUpdatedAt) > new Date(patch.meta._clickupUpdatedAt)) { skipped++; continue; }
    // A recent local status edit may still be in flight to ClickUp.
    if (existing && now - Number(existing.last_status_change_at || 0) < 45_000) patch.status = existing.status;
    if (existing && now - Number(existing.meta?._dueChangedAt || 0) < 45_000) {
      patch.meta.dueDate = existing.meta.dueDate;
      patch.meta._dueDateMs = existing.meta._dueDateMs;
    }
    if (!existing) {
      patch.created_at = clickUpDate(task.date_created) || new Date(now).toISOString();
      patch.ad_origin = 'ClickUp';
      patch.ad_type ||= 'Video';
      patch.funnel_stage ||= 'TOF';
      patch.meta.taskType ||= 'format';
    }
    if (patch.status !== existing?.status) patch.last_status_change_at = now;
    patch.meta = { ...(existing?.meta || {}), ...patch.meta };
    // Unsynced Tracker edits remain authoritative until acknowledged, not just for a short grace window.
    for (const key of Object.keys(existing?.meta?._trackerPending || {})) {
      if (key.startsWith('custom:')) {
        patch.meta._customFields = existing.meta._customFields || {};
        patch.meta._customFieldsRaw = existing.meta._customFieldsRaw || {};
        if (key === 'custom:__task_assignees') patch.meta.assignees = existing.meta.assignees || [];
      } else if (Object.hasOwn(patch, key) && key !== 'meta') patch[key] = existing[key];
      else if (Object.hasOwn(existing?.meta || {}, key)) patch.meta[key] = existing.meta[key];
      if (key === 'dueDate') patch.meta._dueDateMs = existing.meta._dueDateMs;
      if (key === 'status') patch.last_status_change_at = existing.last_status_change_at;
    }
    if (existing?.meta?.taskType === 'production') patch.meta.taskType = 'production';
    changedByTask.set(String(task.id), patch);
    if (!existing || Object.entries(patch).some(([key, value]) => !sameData(existing[key], value))) {
      adChanges.push({ id, expected_updated_at: existing?.updated_at || null, patch });
    }
  }
  for (const action of actions) {
    const payload = action.payload || {};
    const taskId = payload._clickupId || payload.clickupTaskId;
    const patch = changedByTask.get(taskId);
    if (!patch) continue;
    const next = { ...payload, title: patch.format_name };
    if (Object.hasOwn(patch.meta, 'dueDate') && now - Number(payload._dueChangedAt || 0) >= 45_000) {
      Object.assign(next, { dueDate: patch.meta.dueDate, _dueDateMs: patch.meta._dueDateMs });
    }
    const status = now - Number(payload._liveStatusChangedAt || 0) < 45_000 ? action.live_status : patch.status;
    next.liveStatus = status;
    if (!sameData(next, payload) || status !== action.live_status) actionChanges.push({
      id: action.id, expected_updated_at: action.updated_at, payload: next, live_status: status,
    });
  }
  return { ads: adChanges, actions: actionChanges, fetched: seen.size, skipped };
}
