import { CLICKUP_FIELDS } from './clickup-sync.js';
import { TASK_ASSIGNEES_FIELD, customFieldInputValue, validateCustomFieldValue } from './tracker-editing.js';

const columns = { angle: 'angle', persona: 'persona', ad_type: 'adType', funnel_stage: 'funnelStage', ad_link: 'adLink', drive_link: 'driveLink' };
const metadata = new Set(['creativeStructure', 'hookType', 'productionStyle', 'creativeUSP']);
const supported = new Set(['users', 'drop_down', 'labels', 'text', 'short_text', 'number', 'currency', 'date', 'checkbox', 'url', 'email', 'phone']);

export function planFieldBinding(name, schema) {
  const normalized = name.trim().toLowerCase();
  const field = schema?.fields.find(field => field.name.trim().toLowerCase() === normalized)
    || (['angle', 'persona'].includes(normalized) ? schema?.fields.find(field => field.id === schema.mappings[normalized]) : null)
    || (normalized === 'editor' ? schema?.fields.find(field => field.id === TASK_ASSIGNEES_FIELD.id) : null);
  if (!field) return null;
  const key = Object.keys(CLICKUP_FIELDS).find(key => schema.mappings[key] === field.id
    || (['angle', 'persona'].includes(key) && CLICKUP_FIELDS[key].includes(normalized))) || '';
  // Parent/variation identity uses its own workflow, never a generic field write.
  const canonical = Boolean(key);
  const editable = canonical ? Boolean(columns[key] || metadata.has(key)) && ['text', 'short_text', 'url', 'drop_down'].includes(field.type) : supported.has(field.type);
  return { field, key, canonical, editable, inline: editable && (['angle', 'persona'].includes(key) || ['users', 'drop_down', 'labels'].includes(field.type)) };
}

export function planControlValue(binding, action) {
  if (binding.canonical) {
    const value = columns[binding.key] ? action.display[columns[binding.key]] : action.linkedAdMeta[binding.key];
    return String(value ?? action.linkedAdMeta._customFields?.[binding.field.name.toLowerCase()] ?? '');
  }
  const raw = binding.field.id === TASK_ASSIGNEES_FIELD.id ? action.linkedAdMeta.assignees
    : action.linkedAdMeta._customFieldsRaw?.[binding.field.name.toLowerCase()];
  return customFieldInputValue(binding.field, raw);
}

export function planCanonicalPatch(binding, value, taxonomy) {
  if (!binding.canonical || !binding.editable) throw new Error('This field is read-only.');
  const text = String(value ?? '');
  if (['angle', 'persona'].includes(binding.key)) {
    if (text && !taxonomy[binding.key === 'angle' ? 'angles' : 'personas'].includes(text)) throw new Error(`Select an existing ${binding.key}.`);
  } else if (binding.field.type === 'drop_down') {
    if (text && !(binding.field.type_config?.options || []).some(option => (option.name || option.label) === text)) throw new Error(`Select an existing option for ${binding.field.name}.`);
  } else validateCustomFieldValue(binding.field, text);
  return metadata.has(binding.key) ? { meta: { [binding.key]: text } } : { [binding.key]: text };
}
