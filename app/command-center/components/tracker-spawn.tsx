'use client';
import { useEffect, useState } from 'react';
import { Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { FUNNEL_STAGES } from '../../../lib/domain/tracker-editing.js';
import { VARIATION_TEMPLATES, variationAxes, variationRows } from '../../../lib/domain/variation-lab.js';
import type { Creative } from '../types';
import type { TrackerSchema } from '../hooks/use-tracker-actions';
import styles from '../../command-center.module.css';

const newRow = (axis = 'Hook') => ({ id: crypto.randomUUID(), axis, customAxis: '', mode: 'split', advanced: false, from: '', to: '', hypothesis: '', brief: '', dueDate: '', editorIds: [] as string[], reviewerIds: [] as string[] });
export function TrackerSpawn({ creative, creatives, busy, disabled = false, spawn, schema, loadSchema, variationOnly = false }: { creative: Creative; creatives: Creative[]; busy: boolean; disabled?: boolean; variationOnly?: boolean;
  schema: TrackerSchema | null; loadSchema: () => Promise<unknown>;
  spawn: (creative: Creative, kind: string, rows: Record<string, unknown>[], fileId: string) => Promise<unknown> }) {
  const [kind, setKind] = useState('variation');
  const [rows, setRows] = useState(() => [newRow()]);
  const [file, setFile] = useState('');
  const [axes, setAxes] = useState(() => variationAxes([]));
  const [lastAxis, setLastAxis] = useState('Hook');
  const [error, setError] = useState('');
  useEffect(() => { try { setAxes(variationAxes(JSON.parse(localStorage.getItem('varlab.customAxes') || '[]'))); } catch { /* Ignore invalid saved custom axes. */ } }, []);
  const [defaults, setDefaults] = useState({ editorIds: [] as string[], reviewerIds: [] as string[], dueDate: '' });
  const missing = FUNNEL_STAGES.filter((stage) => !creatives.some((ad) => ad.productId === creative.productId && !ad.deletedAt && ad.angle === creative.angle && ad.persona === creative.persona && ad.funnelStage === stage));
  const [stages, setStages] = useState(missing);
  const patch = (id: string, values: Partial<ReturnType<typeof newRow>>) => setRows((current) => current.map((row) => row.id === id ? { ...row, ...values } : row));
  const selectedStages = stages.filter((stage) => missing.includes(stage));
  function template(axis: string, count: number) {
    const dirty = rows.some((row) => row.from || row.to || row.hypothesis || row.brief || row.dueDate || row.customAxis || row.editorIds.length || row.reviewerIds.length);
    if (dirty && !window.confirm('Replace the variation drafts with this template? Assignment defaults will be kept.')) return;
    setRows(Array.from({ length: count }, () => newRow(axis))); setLastAxis(axis); setError('');
  }
  async function submit() {
    if (busy || disabled) return;
    setError('');
    try {
      const payload = kind === 'variation' ? variationRows(rows, defaults) : selectedStages.map((stage) => ({ stage, ...defaults }));
      if (!payload.length) throw new Error('Select a missing funnel stage.');
      if (kind === 'variation') {
        const savedAxes = variationAxes([...axes, ...payload.map((row) => 'axis' in row ? row.axis : '')]);
        setAxes(savedAxes);
        try { localStorage.setItem('varlab.customAxes', JSON.stringify(savedAxes.filter((axis) => !variationAxes([]).includes(axis)))); } catch { /* Storage is optional. */ }
      }
      await spawn(creative, kind, payload, file);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Variation creation failed.'); }
  }
  return <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    <fieldset disabled={busy || disabled} className={styles.trackerForm}>
      <div className={styles.trackerFormGrid}>
        {!variationOnly ? <label>Creation type<select aria-label="Creation type" value={kind} onChange={(event) => setKind(event.target.value)}><option value="variation">Winner variations</option><option value="funnel">Funnel expansion</option></select></label> : null}
        <label>Winning file reference<select aria-label="Winning file reference" value={file} onChange={(event) => setFile(event.target.value)}><option value="">Parent reference</option>
          {creative.winningArtifacts.map((item: { id: string; name: string }) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
      </div>
      <details open className={styles.variationDefaults}><summary>Assignment defaults</summary><button type="button" onClick={() => void loadSchema()}>Load ClickUp members</button>
        <div className={styles.trackerFormGrid}>
          <label>Default due date<input type="date" value={defaults.dueDate} onChange={(event) => setDefaults({ ...defaults, dueDate: event.target.value })} /></label>
          {schema ? <><MemberSelect label="Default editors" values={defaults.editorIds} members={schema.members} change={(editorIds) => setDefaults({ ...defaults, editorIds })} />
            <MemberSelect label="Default reviewers" values={defaults.reviewerIds} members={schema.members} change={(reviewerIds) => setDefaults({ ...defaults, reviewerIds })} /></> : null}
        </div>
      </details>
      {kind === 'variation' ? <>
        <div className={styles.variationTemplates} role="group" aria-label="Variation templates">{VARIATION_TEMPLATES.map((item) => <button type="button" key={item.axis} onClick={() => template(item.axis, item.count)}><Plus size={14} />{item.label}</button>)}</div>
        {rows.map((row, index) => <section key={row.id} className={styles.variationDraft} aria-label={`Variation ${index + 1}`}>
          <header><strong>Variation {index + 1}</strong><div className={styles.trackerButtons}>
            <button type="button" aria-label={`Advanced variation ${index + 1}`} aria-expanded={row.advanced} title="Advanced fields" onClick={() => patch(row.id, { advanced: !row.advanced })}><SlidersHorizontal size={16} /></button>
            <button type="button" aria-label={`Remove variation ${index + 1}`} title="Remove variation" disabled={rows.length === 1} onClick={() => setRows(rows.filter((item) => item.id !== row.id))}><Trash2 size={16} /></button></div></header>
          <div className={styles.trackerFormGrid}>
            <label>Change axis<select aria-label="Change axis" value={row.axis} onChange={(event) => patch(row.id, { axis: event.target.value, advanced: row.advanced || event.target.value === '__custom__' })}>{axes.map((axis) => <option key={axis}>{axis}</option>)}<option value="__custom__">Custom axis...</option></select></label>
            <label>Editor brief<textarea aria-label="Editor brief" rows={2} value={row.brief} onChange={(event) => patch(row.id, { brief: event.target.value })} /></label>
          </div>
          <div hidden={!row.advanced} className={styles.variationAdvanced}>
            {row.axis === '__custom__' ? <label>Custom axis name<input maxLength={80} value={row.customAxis} onChange={(event) => patch(row.id, { customAxis: event.target.value })} /></label> : null}
            <div className={styles.variationModes} role="group" aria-label={`Variation ${index + 1} change mode`}>
              <button type="button" aria-pressed={row.mode === 'split'} onClick={() => patch(row.id, { mode: 'split' })}>From / To</button>
              <button type="button" aria-pressed={row.mode === 'note'} onClick={() => patch(row.id, { mode: 'note' })}>Single note</button>
            </div>
          <div className={styles.trackerFormGrid}>
            <label>{row.mode === 'note' ? 'Change note' : 'From'}<input value={row.from} onChange={(event) => patch(row.id, { from: event.target.value })} /></label>
            {row.mode === 'split' ? <label>To<input value={row.to} onChange={(event) => patch(row.id, { to: event.target.value })} /></label> : null}
            <label>Hypothesis<textarea aria-label="Hypothesis" rows={2} value={row.hypothesis} onChange={(event) => patch(row.id, { hypothesis: event.target.value })} /></label>
            <label>Due date<input type="date" value={row.dueDate} onChange={(event) => patch(row.id, { dueDate: event.target.value })} /></label>
            {schema ? <><MemberSelect label={`Variation ${index + 1} editors`} values={row.editorIds} members={schema.members} change={(editorIds) => setRows(rows.map((item) => item.id === row.id ? { ...item, editorIds } : item))} />
              <MemberSelect label={`Variation ${index + 1} reviewers`} values={row.reviewerIds} members={schema.members} change={(reviewerIds) => setRows(rows.map((item) => item.id === row.id ? { ...item, reviewerIds } : item))} /></> : null}
          </div></div>
        </section>)}
        <button type="button" disabled={rows.length >= 20} onClick={() => setRows([...rows, newRow(lastAxis)])}><Plus size={16} />Add variation</button>
      </> : <div className={styles.trackerButtons}>{missing.length ? missing.map((stage) => <label className={styles.trackerCheck} key={stage}><input type="checkbox" checked={stages.includes(stage)} onChange={(event) => setStages(event.target.checked ? [...stages, stage] : stages.filter((item) => item !== stage))} />{stage}</label>) : <p>All funnel stages already exist in this cell.</p>}</div>}
      <footer><button type="submit" disabled={kind === 'funnel' && !selectedStages.length}><Plus size={16} />{busy ? 'Creating...' : kind === 'variation' ? `Create ${rows.length} variations` : 'Create missing stages'}</button></footer>
    </fieldset>
  </form>;
}

function MemberSelect({ label, members, values, change }: { label: string; members: TrackerSchema['members']; values: string[]; change: (ids: string[]) => void }) {
  return <label>{label}<select aria-label={label} multiple value={values} onChange={(event) => change([...event.target.selectedOptions].map((option) => option.value))}>
    {values.filter((value) => !members.some((member) => String(member.id) === value)).map((value) => <option key={value} value={value}>User {value}</option>)}
    {members.map((member) => <option key={member.id} value={member.id}>{member.username || member.email || member.id}</option>)}
  </select></label>;
}
