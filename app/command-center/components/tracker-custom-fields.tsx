'use client';
import type { TrackerSchema } from '../hooks/use-tracker-actions';
import styles from '../../command-center.module.css';

type Field = TrackerSchema['fields'][number];
export function TrackerCustomFields({ fields, members, values, onChange }: { fields: Field[]; members: TrackerSchema['members']; values: Record<string, unknown>; onChange: (id: string, value: unknown) => void }) {
  return <div className={styles.trackerFormGrid}>{fields.map((field) => {
    const value = values[field.id];
    const label = `${field.name} custom field`;
    if (field.type === 'checkbox') return <label key={field.id} className={styles.trackerCheck}><input aria-label={label} type="checkbox" checked={value === true} onChange={(event) => onChange(field.id, event.target.checked)} />{field.name}</label>;
    if (['drop_down', 'labels', 'users'].includes(field.type)) {
      const options = field.type === 'users' ? members.map((user) => ({ id: String(user.id), name: user.username || user.email || String(user.id) }))
        : (field.type_config?.options || []).map((option) => ({ id: option.id, name: option.name || option.label || option.id }));
      const multi = field.type !== 'drop_down';
      const selected = Array.isArray(value) ? value.map(String) : [];
      // Preserve current members even when ClickUp omits inherited list memberships.
      if (field.type === 'users') for (const id of selected) if (!options.some((option) => option.id === id)) options.push({ id, name: `User ${id}` });
      return <label key={field.id}>{field.name}<select aria-label={label} multiple={multi} value={multi ? selected : String(value || '')}
        onChange={(event) => onChange(field.id, multi ? [...event.target.selectedOptions].map((option) => option.value) : event.target.value)}>
        {!multi ? <option value="">Not set</option> : null}{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select></label>;
    }
    const editable = ['text', 'short_text', 'url', 'email', 'phone', 'date', 'number', 'currency'].includes(field.type);
    return <label key={field.id}>{field.name}{field.type === 'text'
      ? <textarea aria-label={label} value={String(value || '')} onChange={(event) => onChange(field.id, event.target.value)} />
      : <input aria-label={label} disabled={!editable} type={field.type === 'date' ? 'date' : ['number', 'currency'].includes(field.type) ? 'number' : field.type === 'url' ? 'url' : 'text'} step="any"
        value={String(value ?? '')} onChange={(event) => onChange(field.id, event.target.value)} />}</label>;
  })}</div>;
}
