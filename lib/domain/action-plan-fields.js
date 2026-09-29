import { changedCustomFields, customFieldInputValue, TASK_ASSIGNEES_FIELD } from './tracker-editing.js';
import { clickUpFieldValue } from './clickup-sync.js';

// Canonical fields belong to the creative editor, not a raw custom-field write.
const CANONICAL_FIELDS = new Set(['angle', 'angle tag', 'persona', 'persona tag', 'status', 'ad type', 'funnel stage']);
export function planEditableFields(schema) {
  const mapped = new Set(Object.values(schema.mappings || {}));
  return schema.fields.filter((field) => field.id === TASK_ASSIGNEES_FIELD.id || (!mapped.has(field.id) && !CANONICAL_FIELDS.has(field.name.trim().toLowerCase())));
}

export function planFieldDraft(fields, meta) {
  const raw = meta._customFieldsRaw || {};
  return Object.fromEntries(fields.map((field) => [field.id, customFieldInputValue(field,
    field.id === TASK_ASSIGNEES_FIELD.id ? (meta.assignees ?? raw.editor) : raw[field.name.toLowerCase()])]));
}

export function planFieldChanges(fields, draft, baseline, members) {
  const changes = changedCustomFields(fields, draft, baseline);
  for (const [id, change] of Object.entries(changes)) {
    const value = change.type === 'users' && Array.isArray(change.value)
      ? change.value.map((id) => members.find((member) => String(member.id) === String(id)) || { id, username: `User ${id}` }) : change.value;
    change.display = clickUpFieldValue({ ...fields.find((field) => field.id === id), value });
  }
  return changes;
}

export function planPeopleLabel(meta, kind) {
  const raw = meta._customFieldsRaw || {}, display = meta._customFields || {};
  const people = kind === 'editor' ? (Object.hasOwn(raw, 'editor') ? raw.editor : meta.assignees) : raw.reviewer;
  if (!Array.isArray(people)) return String(display[kind] || 'Unassigned');
  if (!people.length) return 'Unassigned';
  if (people.every((person) => person?.username || person?.name || person?.email)) return people.map((person) => person.username || person.name || person.email).join(', ');
  const sameMembers = (other) => Array.isArray(other) && people.map((p) => String(p?.id ?? p)).sort().join(',') === other.map((p) => String(p?.id ?? p)).sort().join(',');
  const cached = kind === 'editor'
    ? (sameMembers(raw['task assignees']) ? display['task assignees'] : sameMembers(raw.editor) ? display.editor : '')
    : display.reviewer;
  if (cached) return String(cached);
  return people.map((person) => person?.username || person?.name || person?.email || `User ${person?.id ?? person}`).join(', ');
}
