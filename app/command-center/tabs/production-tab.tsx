import { useState } from 'react';
import { PRODUCTION_FORMATS } from '../../../lib/domain/production.js';
import styles from '../../command-center.module.css';
import { useProduction } from '../hooks/use-production';
import type { Product } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CalendarDays, RefreshCw, Plus, Ellipsis } from 'lucide-react';
import { safeCreativeUrl } from '../../../lib/domain/tracker-editing.js';
import { ProductionDueEditor } from '../components/production-due-editor';
import { useProductionTasks } from '../hooks/use-production-tasks';
import { usePlanDeletion } from '../hooks/use-plan-deletion';
import { usePlanRecreation } from '../hooks/use-plan-recreation';
import { PlanDeleteDialog, PlanDeletedCreatives } from '../components/plan-deletion';
import { PlanRecreationDialog } from '../components/plan-recreation-dialog';
import { PlanCreativeDialog } from '../components/plan-creative-dialog';
import { PlanFieldsDialog } from '../components/plan-fields-dialog';
import { TrackerDialog } from '../components/tracker-dialog';
import { ProductionCreateDialog } from '../components/production-create-dialog';
import { ProductionTaskControls } from '../components/production-task-controls';

export function ProductionTab({ supabase, activeProductId, activeProduct }: { supabase: SupabaseClient; activeProductId: string; activeProduct?: Product }) {
  const board=useProduction({supabase,activeProductId,activeProduct});
  const tasks=useProductionTasks(supabase,activeProductId,board);
  const deletion=usePlanDeletion(supabase,activeProductId,board);
  const repair=usePlanRecreation(supabase,activeProductId,board);
  const [expanded,setExpanded]=useState<string[]>([]);
  const {
    columns,
    busy,
    reload,
    error,
    loadedAt,
    dropTarget,
    setDropTarget,
    dropInto,
    draggedActionId,
    busyAction: boardBusy,
    startDrag,
    endDrag,
    updateStatus,
    notice, dueAction, openDue, closeDue, saveDue,
  } = board;
  const busyAction=Boolean(boardBusy || tasks.busy || deletion.busy || repair.busy);

  return (
    <>
      <section className={styles.productionToolbar} aria-label="Production controls">
        <h2>Production Board</h2>
        <button type="button" aria-label="Add production task" disabled={busyAction} onClick={()=>tasks.setCreating(true)}><Plus size={14}/>Add Task</button>
        <button disabled={Boolean(busyAction)} type="button" onClick={reload} aria-label="Refresh" title="Refresh"><RefreshCw size={16} /></button>
      </section>
      {error && !dueAction && !tasks.editor ? <div role="alert" className={styles.error}>{error}</div> : null}
      {notice ? <p role="status" className={styles.notice}>{notice}</p> : null}
      {deletion.notice?<p role="status" className={styles.notice}>{deletion.notice}</p>:null}
      {repair.notice?<p role="status" className={styles.notice}>{repair.notice}</p>:null}
      <section className={styles.productionBoard} aria-label="Production board" aria-busy={busy}>
        {columns.map((column) => (
          <article
            className={`${styles.productionColumn} ${dropTarget === column.id ? styles.productionColumnDrop : ''}`}
            key={column.id}
            aria-label={column.title}
            data-production-column={column.id}
            onDragEnter={(event) => { if (draggedActionId && !busyAction) { event.preventDefault(); setDropTarget(column.id); } }}
            onDragOver={(event) => { if (draggedActionId && !busyAction) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget(''); }}
            onDrop={(event) => { event.preventDefault(); void dropInto(column.id); }}
          >
            <header>
              <div>
                <strong>{column.title}</strong>
                <span>{column.subtitle}</span>
              </div>
              <em aria-label={`${column.title} count`}>{loadedAt ? column.rows.length : '-'}</em>
            </header>
            <div className={styles.productionCards}>
              {column.rows.length ? column.rows.map((action) => (
                <div
                  className={`${styles.productionCard} ${draggedActionId === action.display.dbId ? styles.productionCardDragging : ''}`}
                  draggable={!busyAction && !dueAction && !board.locked(action)}
                  data-production-task={action.display.dbId}
                  key={action.display.dbId || action.display.id}
                  onDragEnd={endDrag}
                  onDragStart={(event) => {
                    if ((event.target as HTMLElement).closest('button,input,select,a')) { event.preventDefault(); return; }
                    event.dataTransfer.setData('text/plain', `production:${action.display.dbId}`);
                    event.dataTransfer.effectAllowed = 'move'; startDrag(action);
                  }}
                >
                  <div className={styles.productionCardHeading}>
                    <strong>{action.display.title || action.display.id}</strong>
                    <button type="button" aria-label={`Task controls for ${action.display.title}`} title="Task controls" aria-expanded={expanded.includes(action.display.dbId)} aria-controls={`production-controls-${action.display.dbId}`} onClick={()=>setExpanded((ids)=>ids.includes(action.display.dbId)?ids.filter((id)=>id!==action.display.dbId):[...ids,action.display.dbId])}><Ellipsis size={16}/></button>
                  </div>
                  <div className={styles.productionTags}>
                    {action.display.angle?<span>{action.display.angle}</span>:null}
                    {action.display.persona?<><i>x</i><span>{action.display.persona}</span></>:null}
                  </div>
                  <div className={styles.productionTags}>
                    {(action.payload.format || action.display.adType)?<span>{String(action.payload.format || action.display.adType)}</span>:null}
                    {action.display.funnelStage?<span data-funnel={action.display.funnelStage}>{action.display.funnelStage}</span>:null}
                    {action.payload.tag==='ai-recommended'?<span data-ai="true">AI Rec</span>:null}
                    {board.locked(action)?<span data-recovery="true">ClickUp recovery needed</span>:null}
                  </div>
                  <div className={styles.productionDue}>
                    <span>{action.display.dueDate ? `Due: ${action.display.dueDate}` : 'No due date'}</span>
                    <button type="button" disabled={busyAction || board.locked(action)} onClick={() => openDue(action)} aria-label={`Edit due date for ${action.display.title}`} title="Edit due date"><CalendarDays size={12} /></button>
                  </div>
                  <div id={`production-controls-${action.display.dbId}`} hidden={!expanded.includes(action.display.dbId)} className={styles.productionTaskPanel}>
                    <label>Format<select aria-label={`Format for ${action.display.title}`} value={String(action.payload.format || '')} disabled={busyAction || !tasks.available(action)} onChange={(event)=>void tasks.saveFormat(action,event.target.value)}>
                      <option value="">Not set</option>{[...new Set([...PRODUCTION_FORMATS,String(action.payload.format || '')])].filter(Boolean).map((value)=><option key={value}>{value}</option>)}
                    </select></label>
                    <label>Status
                      <select aria-label={`Status for ${action.display.title}`} disabled={busyAction || board.locked(action) || board.statusUnavailable(action)} value={action.display.status} onChange={(event) => updateStatus(action, event.target.value)}>
                        {board.statusOptions(action).map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </label>
                  <div className={styles.actionLinks}>
                    {([['ClickUp', action.display.clickupUrl], ['Drive', action.display.driveLink], ['Inspiration', action.display.adLink]]).map(([label, url]) => safeCreativeUrl(url) ? <a key={label} href={safeCreativeUrl(url)} target="_blank" rel="noreferrer">{label}</a> : null)}
                  </div>
                  <ProductionTaskControls action={action} board={board} tasks={tasks} deletion={deletion} repair={repair} busy={busyAction}/>
                  </div>
                </div>
              )) : <div className={styles.emptyState}>{!loadedAt ? (busy ? 'Loading...' : 'Production data unavailable.') : 'No production tasks.'}</div>}
            </div>
          </article>
        ))}
      </section>
      <PlanDeletedCreatives rows={board.deletedCreatives} deletion={deletion} busy={busyAction}/>
      {dueAction ? <ProductionDueEditor key={dueAction.display.dbId} action={dueAction} busy={Boolean(busyAction)} error={error} onClose={closeDue} onSave={saveDue} /> : null}
      {tasks.creating?<ProductionCreateDialog db={supabase} productId={activeProductId} run={tasks.run} close={()=>tasks.setCreating(false)} done={()=>{tasks.setCreating(false);board.setNotice('Production task saved in QA. ClickUp was not changed.');}}/>:null}
      {tasks.editor?.kind==='details'?<PlanCreativeDialog db={supabase} productId={activeProductId} action={tasks.editor.action} busy={busyAction} error={error} save={tasks.saveDetails} close={tasks.close}/>:null}
      {tasks.editor?.kind==='fields'?<PlanFieldsDialog db={supabase} productId={activeProductId} action={tasks.editor.action} busy={busyAction} error={error} save={tasks.saveFields} close={tasks.close}/>:null}
      {tasks.editor?.kind==='remove'?<TrackerDialog title="Remove production task" busy={busyAction} error={error} onClose={tasks.close}>
        <p>Remove {tasks.editor.action.display.title} from Production and Action Plan? Its creative, Matrix assignments and ClickUp task will be preserved.</p>
        <footer><button type="button" disabled={busyAction} onClick={tasks.close}>Cancel</button><button type="button" disabled={busyAction} onClick={()=>void tasks.remove()}>Remove task</button></footer>
      </TrackerDialog>:null}
      {deletion.target?<PlanDeleteDialog key={`${deletion.target.adId}:${deletion.target.deletedAt}`} deletion={deletion}/>:null}
      {repair.target?<PlanRecreationDialog repair={repair}/>:null}
    </>
  );
}
