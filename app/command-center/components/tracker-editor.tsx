'use client';
import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { AD_TYPES, FUNNEL_STAGES, trackerDraft, customFieldInputValue, changedCustomFields, TASK_ASSIGNEES_FIELD } from '../../../lib/domain/tracker-editing.js';
import { clickUpFieldValue } from '../../../lib/domain/clickup-sync.js';
import { workflowStatuses } from '../helpers/creatives';
import type { Creative } from '../types';
import type { TrackerSchema } from '../hooks/use-tracker-actions';
import { TrackerCustomFields } from './tracker-custom-fields';
import { ProductFieldInput } from './product-field-catalog';
import styles from '../../command-center.module.css';

export function TrackerEditor({ creative, taxonomy, schema, loadSchema, save, busy, includeWorkflow = true, includeCustom = true }: {
  creative: Creative | null; taxonomy: { angles: string[]; personas: string[] }; schema: TrackerSchema | null;
  loadSchema: () => Promise<unknown>; save: (creative: Creative | null, draft: Record<string, string>, custom: Record<string, unknown>, push: boolean) => Promise<unknown>; busy: boolean;
  includeWorkflow?: boolean; includeCustom?: boolean;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() => trackerDraft(creative || {}));
  const [custom, setCustom] = useState<Record<string, unknown>>({});
  const [baseline, setBaseline] = useState<Record<string, unknown>>({});
  const [push, setPush] = useState(true);
  const [error, setError] = useState('');
  const fields = schema?.fields.filter((field) => !Object.values(schema.mappings || {}).includes(field.id)) || [];
  useEffect(() => {
    const raw = (creative as Record<string, unknown> | null)?._customFieldsRaw as Record<string, unknown> || {};
    const initial = Object.fromEntries((schema?.fields || []).map((field) => [field.id, customFieldInputValue(field,
      field.id === TASK_ASSIGNEES_FIELD.id ? (creative as Record<string, unknown> | null)?.assignees : raw[field.name.toLowerCase()])]));
    setCustom(initial); setBaseline(initial);
  }, [schema, creative]);
  const set = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const select = (key: string, label: string, options: string[]) => <label key={key}>{label}<select aria-label={label} value={draft[key]} onChange={(event) => set(key, event.target.value)}>
    <option value="">Not set</option>{[...new Set([...options, draft[key]])].filter(Boolean).map((value) => <option key={value}>{value}</option>)}
  </select></label>;
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('');
    try {
      const changes = changedCustomFields(fields, custom, baseline);
      for (const [id, item] of Object.entries(changes) as [string, { name: string; type: string; value: unknown; display?: string }][]) {
        const value = item.type === 'users' && Array.isArray(item.value)
          ? item.value.map((id) => schema?.members.find((member) => member.id === id) || { id }) : item.value;
        item.display = clickUpFieldValue({ ...fields.find((field) => field.id === id), value });
      }
      await save(creative, draft, changes, push);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save creative.'); }
  }
  return <form onSubmit={submit}>
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    <fieldset disabled={busy} className={styles.trackerForm}>
      <div className={styles.trackerFormGrid}>
        <label className={styles.trackerWide}>Creative name<input required value={draft.formatName} onChange={(event) => set('formatName', event.target.value)} /></label>
        {select('angle', 'Angle', taxonomy.angles)}{select('persona', 'Persona', taxonomy.personas)}
        {select('adType', 'Ad type', AD_TYPES)}{select('funnelStage', 'Funnel stage', FUNNEL_STAGES)}
        {includeWorkflow ? <>{select('status', 'Status', workflowStatuses(draft.status))}
        <label>Due date<input type="date" value={draft.dueDate} onChange={(event) => set('dueDate', event.target.value)} /></label></> : null}
        {[['adLink','Inspiration link'],['driveLink','Drive link'],['creativeStructure','Creative structure'],['hookType','Hook type'],['productionStyle','Production style'],['creativeUSP','Creative USP'],['winningElement','Winning element']].map(([key,label]) => <label key={key}>{label}{['creativeStructure','hookType','productionStyle'].includes(key) ? <ProductFieldInput field={key} label={label} value={draft[key]} onChange={(value) => set(key,value)} /> : <input type={key.endsWith('Link') ? 'url' : 'text'} value={draft[key]} onChange={(event) => set(key,event.target.value)} />}</label>)}
        <label className={styles.trackerWide}>Creative hypothesis<textarea aria-label="Creative hypothesis" value={draft.creativeHypothesis} onChange={(event) => set('creativeHypothesis',event.target.value)} /></label>
        <label className={styles.trackerWide}>Notes<textarea aria-label="Notes" value={draft.notes} onChange={(event) => set('notes',event.target.value)} /></label>
      </div>
      {includeCustom ? <details><summary>Custom fields</summary><button type="button" onClick={() => void loadSchema()}>Load ClickUp fields</button>
        {schema ? <TrackerCustomFields fields={fields} members={schema.members} values={custom} onChange={(id,value) => setCustom((current) => ({ ...current, [id]: value }))} /> : null}
      </details> : null}
      <footer>{creative?.clickupTaskId ? <label className={styles.trackerCheck}><input type="checkbox" checked={push} onChange={(event) => setPush(event.target.checked)} />Update linked ClickUp task</label> : null}
        <button type="submit"><Save size={16} />{busy ? 'Saving...' : 'Save creative'}</button></footer>
    </fieldset>
  </form>;
}
