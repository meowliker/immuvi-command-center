import { CLICKUP_FIELDS, inferClickUpMappings, clickUpWriteFields } from './clickup-sync.js';
import { validateCustomFieldValue, TASK_ASSIGNEES_FIELD } from './tracker-editing.js';

export const creationMarker = (id) => `IMMUVI_QA_JOB:${id}`;
const present = (value) => value !== undefined && value !== null && value !== '';

export function creationStatus(wanted, statuses = []) {
  const aliases = { untested:['to do','todo','open'], approved:['review','in progress','to do'], assigned:['review','in progress','to do'],
    'in production':['in progress','review','to do'], 'ready to launch':['review','in progress','to do'], testing:['review','in progress','to do'],
    'mild winner':['winner','review','in progress'], winner:['review','in progress'], loser:['complete','closed'],
    killed:['closed','complete'], scale:['in progress','review'], complete:['done','closed'] };
  const key=String(wanted || 'Untested').toLowerCase();
  for (const name of [key,...(aliases[key] || [])]) {
    const found=statuses.find((s) => s.status?.toLowerCase()===name);
    if (found) return found.status;
  }
  return statuses.find((s) => s.type==='open')?.status || statuses[0]?.status;
}

function fieldValue(field, raw) {
  const options = field.type_config?.options || [];
  const optionId = (value) => {
    const option = options.find((o) => String(o.id) === String(value))
      || options.find((o) => String(o.name || o.label).trim().toLowerCase() === String(value).trim().toLowerCase())
      || options.find((o) => String(o.orderindex) === String(value));
    if (!option) throw new Error(`No matching option for ${field.name}. Update the QA field mapping first.`);
    return option.id;
  };
  if (field.type === 'drop_down') raw = optionId(raw);
  if (field.type === 'labels') raw = (Array.isArray(raw) ? raw : [raw]).map(optionId);
  if (field.type === 'users') raw = (Array.isArray(raw) ? raw : []).map((user) => user?.id ?? user);
  if (field.type === 'date' && /^\d+$/.test(String(raw))) raw = Number(raw);
  if (field.type === 'checkbox' && ['true', 'false'].includes(raw)) raw = raw === 'true';
  const value = validateCustomFieldValue(field, raw);
  return field.type === 'users' ? { add: value, rem: [] } : value;
}

export function buildCreationPayload({ ad, action, product, schema, jobId, mediaKind = '' }) {
  if (ad.product_id !== product.id || action.product_id !== product.id || (action.payload?.sourceAdId || action.payload?.adId || action.payload?._sourceAdId) !== ad.id) {
    throw new Error('Creation source identity does not match the selected product.');
  }
  if (ad.deleted_at || ad.meta?._productBoundaryQuarantined || !ad.format_name?.trim()) throw new Error('Creative is unavailable.');
  const meta = ad.meta || {};
  const mappings = inferClickUpMappings(schema.fields);
  const canonical = { ...ad, ...Object.fromEntries(['creativeStructure','hookType','productionStyle','creativeUSP'].map((k) => [k,meta[k] || ''])) };
  const aliases = { ...CLICKUP_FIELDS, creativeHypothesis:['creative hypothesis'], notes:['notes'], winningElement:['winning element'], product:['product','product name'] };
  // The workspace label may include QA or market suffixes. ClickUp uses the
  // configured product identity, not the profile's display label or source ad.
  const productName=[product.config?.production?.product_name,product.config?.production?.productName,product.name]
    .find(value=>typeof value==='string' && value.trim())?.trim() || '';
  Object.assign(canonical, { creativeHypothesis:meta.creativeHypothesis || '', notes:meta.notes || '', winningElement:meta.winningElement || '', product:productName });
  const custom = [];
  let clickupMediaType='';
  for (const field of schema.fields) {
    const name = field.name?.trim().toLowerCase();
    if (['approved date','launch date','final video id'].includes(name)) continue;
    const mappedKey = Object.keys(mappings).find((key) => mappings[key] === field.id);
    const aliasKey = Object.keys(aliases).find((key) => aliases[key].includes(name));
    if (!mappedKey && aliasKey && Object.hasOwn(mappings,aliasKey) && !mappings[aliasKey]) continue;
    const key = mappedKey || aliasKey;
    let raw = key ? canonical[key] : Object.hasOwn(meta._customFieldsRaw || {},name) ? meta._customFieldsRaw[name] : action.payload._customFieldsRaw?.[name];
    if (!present(raw)) continue;
    if (key==='ad_type' && name==='photo/video' && field.type==='drop_down'
      && ['AI Style','UGC','VSL','Carousel'].includes(raw)
      && !(field.type_config?.options || []).some(option=>String(option.name).trim().toLowerCase()===raw.toLowerCase())) {
      const medium=mediaKind==='video'?'Video':['image','photo','carousel'].includes(mediaKind)?'Photo':'';
      if(medium) { raw=medium;clickupMediaType=medium; }
    }
    if (['angle', 'persona'].includes(key)) {
      const targets = clickUpWriteFields(key, schema.fields, mappings);
      if (!targets.some((target) => target.id === field.id)) continue;
      if (field !== targets[0] && field.type === 'drop_down'
        && !(field.type_config?.options || []).some((option) => option.name?.trim().toLowerCase() === String(raw).trim().toLowerCase())) continue;
    }
    // ClickUp ignores fields scoped to other task types. Fail before creating
    // rather than reporting a successful task with silently missing values.
    if (field.applied_objects?.length && !field.applied_objects.some((o) => Number(o.object_type)===19 && String(o.object_id)==='0')) {
      throw new Error(`${field.name} is not available on standard tasks in this list.`);
    }
    custom.push({ id:field.id, value:fieldValue(field,raw) });
  }
  const status = creationStatus(ad.status,schema.list.statuses);
  const refs = [
    ['Product',product.name], ['Product ID',product.id], ['Creative ID',ad.id], ['Angle',ad.angle], ['Persona',ad.persona],
    ['Ad Type',ad.ad_type], ['ClickUp Media Type',clickupMediaType], ['Funnel Stage',ad.funnel_stage], ['Creative Structure',meta.creativeStructure],
    ['Hook Type',meta.hookType], ['Production Style',meta.productionStyle], ['Creative USP',meta.creativeUSP],
    ['Creative Hypothesis',meta.creativeHypothesis], ['Notes',meta.notes], ['Winning Element',meta.winningElement],
    ['Source Creative',meta.sourceFormatId || ad.parent_ad_id], ['Source Inspiration',meta._fromInspoId || meta._sourceInsId],
    ['Reference Task',meta._sourceClickupId ? `https://app.clickup.com/t/${meta._sourceClickupId}` : ''],
    ['Inspiration',ad.ad_link], ['Inspiration Brief',meta._sourceInspirationBriefUrl || meta.briefUrl], ['Winner Brief',meta.winnerBriefUrl],
    ['Inspiration Drive',meta._sourceFormatDriveLink], ['Winning File',meta._sourceWinnerFileUrl || meta._sourceWinningArtifact?.url], ['Output Drive',ad.drive_link],
    ['Variation Axis',meta.variationChanges?.join(', ') || meta.variationAxis || meta.changeAxis], ['Variation Brief',meta.variationBrief],
    ['Variation From',meta.variationFromText], ['Variation To',meta.variationToText], ['Variation Hypothesis',meta.variationHypothesis],
  ].filter(([,value]) => present(value)).map(([label,value]) => `${label}: ${value}`);
  const brief = action.payload.description || meta.description || '';
  const description = [...refs, brief && `\nBrief:\n${brief}`, `\n${creationMarker(jobId)}`].filter(Boolean).join('\n');
  const dueDate = meta.dueDate ?? action.payload.dueDate ?? '';
  let due = null;
  if (dueDate) {
    const date = Date.parse(`${dueDate}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !Number.isFinite(date) || new Date(date).toISOString().slice(0,10) !== dueDate) throw new Error('Invalid due date.');
    // Date-only tasks use a stable UTC calendar day, independent of the server timezone.
    due = date;
  }
  const assignees = validateCustomFieldValue(TASK_ASSIGNEES_FIELD,(meta.assignees ?? action.payload.assignees ?? []).map((u) => u.id ?? u));
  return { name:ad.format_name, description, ...(status ? {status} : {}), tags:['production','app-created'],
    assignees, ...(due === null ? {} : { due_date:due,due_date_time:false }), custom_fields:custom,
    check_required_custom_fields:true, notify_all:false };
}

export function matchesCreation(task, job) {
  return String(task.list?.id) === job.list_id && String(task.description || task.text_content || '')
    .split(/\r?\n/).some((line) => line.trim() === creationMarker(job.id));
}
