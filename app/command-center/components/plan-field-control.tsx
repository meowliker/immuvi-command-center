'use client';
import { useId, useRef, useState } from 'react';
import { Check, ChevronDown, Pencil, Plus, X } from 'lucide-react';
import type { ActionRecord } from '../types';
import type { useActionPlan } from '../hooks/use-action-plan';
import type { TrackerSchema } from '../hooks/use-tracker-actions';
import { useAnchoredPopover } from '../hooks/use-anchored-popover';
import { planFieldBinding, planControlValue, planCanonicalPatch } from '../../../lib/domain/plan-field-controls.js';
import { planFieldChanges } from '../../../lib/domain/action-plan-fields.js';
import { explicitPlanSource } from '../../../lib/domain/action-plan-editing.js';
import { TrackerCustomFields } from './tracker-custom-fields';
import styles from '../../command-center.module.css';

type Plan = ReturnType<typeof useActionPlan>;
const emptyTaxonomy = { angles: [] as string[], personas: [] as string[] };
export function PlanFieldControl({ name, action, plan, disabled, detail = false }: {
  name: string; action: ActionRecord; plan: Plan; disabled: boolean; detail?: boolean;
}) {
  // A client refreshing from an older controller can briefly lack fieldSchema.
  const schema = plan.fieldSchema?.schema ?? null;
  const taxonomy = plan.fieldSchema?.taxonomy ?? emptyTaxonomy;
  const binding = planFieldBinding(name, schema);
  const current = binding ? planControlValue(binding, action) : '';
  const [pending, setPending] = useState<{ value: unknown } | null>(null);
  const saving = useRef(0);
  const [draft, setDraft] = useState<{ action: ActionRecord; baseline: unknown; value: unknown } | null>(null);
  const submittedDraft = useRef<typeof draft>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const editable = binding?.editable && (detail || binding.inline);
  const single = binding && ((binding.canonical && (['angle', 'persona'].includes(binding.key) || binding.field.type === 'drop_down')) || (!binding.canonical && binding.field.type === 'drop_down'));
  const { trigger, panel } = useAnchoredPopover(Boolean(editable && !single));
  const id = useId();
  const locked = disabled || !action.display.linkedAdId || explicitPlanSource(action) !== action.display.linkedAdId;
  let display = binding?.canonical ? String(pending ? pending.value : current)
    : name === 'Angle' ? action.display.angle || '' : name === 'Persona' ? action.display.persona || ''
      : String((action.linkedAdMeta._customFields as Record<string, unknown> | undefined)?.[binding?.field.name.toLowerCase() || name.toLowerCase()] ?? '');
  if (binding?.field.type === 'users' && Array.isArray(current)) {
    const members = current.map(id => schema?.members.find(member => String(member.id) === String(id)));
    if (!current.length || members.every(Boolean) || !display) display = current.map((id, index) => members[index]?.username || members[index]?.email || `User ${id}`).join(', ');
  }

  async function save(value: unknown, snapshot = action, baseline: unknown = current) {
    if (!binding || !schema) return;
    const request = ++saving.current;
    setError('');
    try {
      const changes = binding.canonical ? planCanonicalPatch(binding, value, taxonomy)
        : planFieldChanges([binding.field], { [binding.field.id]: value }, { [binding.field.id]: baseline }, schema.members);
      const completion = binding.canonical ? plan.saveCreative(snapshot, changes, true) : plan.saveFields(snapshot, changes, true);
      setPending({ value });
      // The plan queue owns persistence; the picker need not wait for ClickUp.
      if (!single) { panel.current?.hidePopover(); setDraft(null); }
      const saved = await completion;
      if (request === saving.current && !saved) setError('Could not save. Check the notification and retry.');
    } catch (cause) { if (request === saving.current) setError(cause instanceof Error ? cause.message : 'Could not save field.'); }
    finally { if (request === saving.current) setPending(null); }
  }

  if (!editable || !binding || !schema) return <span title={display}>{display || '-'}</span>;
  const field: TrackerSchema['fields'][number] = binding.field;
  const label = `${name} for ${action.display.title}`;
  if (single) {
    const options = binding.canonical && ['angle', 'persona'].includes(binding.key)
      ? taxonomy[binding.key === 'angle' ? 'angles' : 'personas'].map(value => ({ value, label: value }))
      : (field.type_config?.options || []).map((option: { id: string; name?: string; label?: string }) => ({ value: binding.canonical ? option.name || option.label || option.id : option.id, label: option.name || option.label || option.id }));
    const value = String(pending ? pending.value : current);
    return <div className={styles.planInlineField}><select aria-label={label} title={display} disabled={locked} value={value} onChange={event => void save(event.target.value)}>
      <option value="">Not set</option>
      {value && !options.some((option: { value: string }) => option.value === value) ? <option value={value}>{display || value}</option> : null}
      {options.map((option: { value: string; label: string }) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>{error ? <small role="alert">{error}</small> : null}</div>;
  }
  const people = field.type === 'users', multiple = people || field.type === 'labels';
  const choices: { id: string; label: string }[] = people ? schema.members.map(member => ({ id: String(member.id), label: member.username || member.email || String(member.id) }))
    : (field.type_config?.options || []).map(option => ({ id: option.id, label: option.name || option.label || option.id }));
  const selected = Array.isArray(draft?.value) ? draft.value.map(String) : [];
  for (const value of selected) if (!choices.some(option => option.id === value)) choices.push({ id: value, label: `${people ? 'User' : 'Option'} ${value}` });
  const pendingLabel = pending && multiple ? (Array.isArray(pending.value) ? pending.value.map(value => choices.find(option => option.id === String(value))?.label || String(value)).join(', ') : '') : null;
  const caption = pendingLabel ?? display;
  return <>
    <button ref={trigger} type="button" className={people ? styles.planPeopleButton : styles.planFieldTrigger} title={caption || name} aria-label={`Edit ${label}`} disabled={locked}
      popoverTarget={id} onClick={() => { const value = pending ? pending.value : current; submittedDraft.current = null; setDraft({ action, baseline: value, value }); setError(''); setSearch(''); }}>
      {people ? <span className={styles.planPersonAvatar} data-empty={!caption}>{caption ? caption.slice(0, 2).toUpperCase() : <Plus size={12} />}</span> : null}
      <span>{caption || (people ? 'Assign' : 'Not set')}</span>{people || multiple ? <ChevronDown size={12} /> : <Pencil size={12} />}
    </button>
    <div ref={panel} id={id} popover="auto" className={styles.planFieldPopover} role="dialog" aria-label={`Edit ${name}`}>
      {draft ? <form onSubmit={event => { event.preventDefault(); if (submittedDraft.current === draft) return; submittedDraft.current = draft; void save(draft.value, draft.action, draft.baseline); }}>
        <header><strong>{name}</strong><button type="button" aria-label={`Close ${name} editor`} onClick={() => panel.current?.hidePopover()}><X size={14} /></button></header>
        <fieldset disabled={locked}>
          {multiple ? <>
            <input type="search" aria-label={`Search ${name}`} placeholder="Search" value={search} onChange={event => setSearch(event.target.value)} />
            <div className={styles.planFieldOptions}>{choices.filter(option => option.label.toLowerCase().includes(search.toLowerCase())).map(option => <label key={option.id}>
              <input type="checkbox" checked={selected.includes(option.id)} onChange={event => setDraft({ ...draft, value: event.target.checked ? [...selected, option.id] : selected.filter(value => value !== option.id) })} />{option.label}
            </label>)}</div>
          </> : binding.canonical ? <label>{name}<input aria-label={`${name} value`} type={field.type === 'url' ? 'url' : 'text'} value={String(draft.value ?? '')} onChange={event => setDraft({ ...draft, value: event.target.value })} /></label>
            : <TrackerCustomFields fields={[field]} members={schema.members} values={{ [field.id]: draft.value }} onChange={(_, value) => setDraft({ ...draft, value })} />}
          <footer><button type="submit"><Check size={14} />Apply</button></footer>
        </fieldset>
        {error ? <p role="alert">{error}</p> : null}
      </form> : null}
    </div>
    {error && !draft ? <small role="alert">{error}</small> : null}
  </>;
}
