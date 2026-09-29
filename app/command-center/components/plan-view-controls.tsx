import { useState } from 'react';
import { ArrowUp, ArrowDown, Columns3, Copy, Save, Trash2, RotateCcw, GripVertical } from 'lucide-react';
import { namedPlanView, planColumn, planViewColumns } from '../../../lib/domain/action-plan-views.js';
import type { ActionRecord } from '../types';
import type { usePlanViews } from '../hooks/use-plan-views';
import type { TrackerSchema } from '../hooks/use-tracker-actions';
import { usePlanColumnDrag } from '../hooks/use-plan-column-drag';
import { TrackerDialog } from './tracker-dialog';
import { useWorkspaceNotice } from './workspace-toasts';
import styles from '../../command-center.module.css';

type Views = ReturnType<typeof usePlanViews>;
function LayoutErrorNotice({ message }: { message: string }) {
  useWorkspaceNotice({ message, title: 'Column preferences', kind: 'error' });
  return null;
}
export function PlanViewControls({ views, actions, fields = [], loaded }: { views: Views; actions: ActionRecord[]; fields?: TrackerSchema['fields']; loaded: boolean }) {
  return <>
    <div className={styles.planViewBar}>
      <label>Saved view<select aria-label="Action Plan saved view" disabled={!views.ready || views.busy} value={views.state.activeViewId} onChange={(e) => void views.switchView(e.target.value)}>{views.state.views.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}</select></label>
      <button type="button" disabled={!loaded || !views.ready || views.busy} onClick={views.open}><Columns3 size={16} />Columns and views</button>
      {views.busy ? <span role="status">Saving or loading views...</span> : null}
    </div>
    {views.error && !views.manager ? <LayoutErrorNotice key={views.error} message={views.error} /> : null}
    {views.manager ? <PlanViewManager views={views} actions={actions} fields={fields} /> : null}
  </>;
}
function PlanViewManager({ views, actions, fields }: { views: Views; actions: ActionRecord[]; fields: TrackerSchema['fields'] }) {
  const snapshot = views.manager!;
  const active = snapshot.state.views.find((view) => view.id === snapshot.state.activeViewId)!;
  const [columns, setColumns] = useState(() => planViewColumns(active, actions, fields));
  const [name, setName] = useState(active.name);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const drag = usePlanColumnDrag((key, target, edge) => {
    setColumns(current => {
      const column = current.find(item => item.key === key);
      if (!column || key === target || !current.some(item => item.key === target)) return current;
      const next = current.filter(item => item.key !== key);
      next.splice(next.findIndex(item => item.key === target) + (edge === 'after' ? 1 : 0), 0, column);
      return next;
    });
  });
  const change = (index: number, patch: Partial<typeof columns[number]>) => setColumns((current) => current.map((column, i) => i === index ? { ...column, ...patch } : column));
  function move(index: number, by: number) {
    setColumns((current) => { const next = [...current]; [next[index], next[index + by]] = [next[index + by], next[index]]; return next; });
  }
  async function save(copy: boolean) {
    setError('');
    try { await views.save(namedPlanView(snapshot.state, columns, copy ? newName : name, copy ? crypto.randomUUID() : active.id), snapshot.expected); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save view.'); }
  }
  async function remove() {
    if (!window.confirm(`Delete saved view "${active.name}"? Tasks will not be changed.`)) return;
    await views.save({ ...snapshot.state, activeViewId: 'default', views: snapshot.state.views.filter((v) => v.id !== active.id) }, snapshot.expected);
  }
  return <TrackerDialog title="Action Plan columns and views" busy={views.busy} onClose={views.close} closeLabel="Close column preferences">
    {error || views.error ? <LayoutErrorNotice key={error || views.error} message={error || views.error} /> : null}
    <fieldset disabled={views.busy} className={styles.planColumnManager}>
      <label>View name<input aria-label="View name" value={name} maxLength={80} disabled={active.id === 'default'} onChange={(e) => setName(e.target.value)} /></label>
      <div ref={drag.list} className={styles.planColumnList}>{columns.map((column, index) => {
        const definition = planColumn(column.key)!;
        return <div key={column.key} className={styles.planColumnRow} data-column-option={column.key}
          data-dragging={drag.source === column.key} data-drop={drag.drop?.key === column.key ? drag.drop?.edge : undefined}>
          <button type="button" className={styles.planColumnGrip} title={`Drag ${definition.label} to reorder`} aria-label={`Drag ${definition.label} to reorder`}
            onPointerDown={event => drag.start(event, column.key)} onPointerMove={drag.update} onPointerUp={drag.end}
            onPointerCancel={drag.cancel} onLostPointerCapture={drag.cancel} onBlur={drag.cancel}
            onKeyDown={event => {
              if (event.key === 'Escape' && drag.source) { event.preventDefault(); event.stopPropagation(); drag.cancel(); }
              if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault(); const by = event.key === 'ArrowUp' ? -1 : 1;
                if (!drag.source && index + by >= 0 && index + by < columns.length) move(index, by);
              }
            }}><GripVertical size={16} /></button>
          <label><input type="checkbox" aria-label={`Show ${definition.label}`} disabled={!!definition.required} checked={!column.hidden} onChange={(e) => change(index, { hidden: !e.target.checked })} /><span>{definition.label}</span></label>
          <button type="button" title={`Move ${definition.label} up`} aria-label={`Move ${definition.label} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} /></button>
          <button type="button" title={`Move ${definition.label} down`} aria-label={`Move ${definition.label} down`} disabled={index === columns.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} /></button>
        </div>;
      })}</div>
      <span className={styles.srOnly} role="status" aria-live="polite">{drag.source && drag.drop ? `${planColumn(drag.source)?.label} ${drag.drop.edge} ${planColumn(drag.drop.key)?.label}` : ''}</span>
      <div className={styles.planViewBar}>
        <button type="button" onClick={() => setColumns(planViewColumns({ columns: [] }, actions, fields))}><RotateCcw size={16} />Reset columns</button>
        <button type="button" onClick={() => void save(false)}><Save size={16} />Save layout</button>
        <button type="button" title="Delete saved view" aria-label="Delete saved view" disabled={active.id === 'default'} onClick={() => void remove()}><Trash2 size={16} /></button>
      </div>
      <div className={styles.planViewBar}><label>New view name<input aria-label="New view name" maxLength={80} value={newName} onChange={(e) => setNewName(e.target.value)} /></label><button type="button" onClick={() => void save(true)}><Copy size={16} />Save as new view</button></div>
    </fieldset>
  </TrackerDialog>;
}
