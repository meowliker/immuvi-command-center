'use client';
import { RotateCcw } from 'lucide-react';
import { classifyMatrixCell } from '../../../lib/domain/creative-matrix.js';
import { cellRelativeDate } from '../helpers/matrix-inspector';
import type { MatrixModel } from '../hooks/use-creative-matrix';
import { TrackerDialog } from './tracker-dialog';
import { TrackerEditor } from './tracker-editor';
import { TrackerSpawn } from './tracker-spawn';
import { TrackerWinners } from './tracker-winners';
import { TrackerDelete } from './tracker-delete';
import { MatrixSourcePicker } from './matrix-source-picker';
import { MatrixInspectorTable } from './matrix-inspector-table';
import { MatrixInsights } from './matrix-insights';
import styles from '../../command-center.module.css';

export function MatrixInspector({ model:m }: { model:MatrixModel }) {
  const editor=m.actions.editor;
  const busy=!!m.busyAction;
  const scope=classifyMatrixCell(m.selectedCreatives,m.preferences);
  const latest=Math.max(0,...m.selectedCreatives.map(ad=>ad.createdAt));
  const taxonomy={ angles:m.angles.map(a=>a.name),personas:m.personas.map(p=>p.name) };
  const title=editor ? editor.kind==='edit' ? 'Edit creative' : editor.kind==='spawn' ? 'Create variations or funnel expansion' : editor.kind==='delete' ? 'Delete creative' : 'Winning files'
    : `${m.selectedAngle?.name} x ${m.selectedPersona?.name}`;
  return <TrackerDialog title={title} closeLabel={editor ? 'Back to cell' : 'Close inspector'} busy={busy} error={m.error}
    className={editor ? '' : styles.cellDialog}
    titleContent={editor ? undefined : <>{m.selectedAngle?.name}<span className={styles.cellTitleSeparator}>x</span>{m.selectedPersona?.name}</>}
    subtitle={editor ? undefined : <div className={styles.cellSummary}><span><b>{scope.total}</b> creatives</span>
      {Object.entries(scope.counts).filter(([,count])=>count>0).map(([bucket,count])=><span key={bucket} data-bucket={bucket}><b>{count}</b> {bucket==='prelaunch' ? 'ready' : bucket==='winner' ? 'winning' : bucket==='loser' ? 'losing' : bucket}</span>)}
      <span>last creative <b>{cellRelativeDate(latest)}</b></span></div>}
    onClose={()=>editor ? m.actions.setEditor(null) : m.setSelection(null)}>
    {m.actions.notice ? <p role="status" className={styles.notice}>{m.actions.notice}</p> : null}
    {editor ? <>
      {editor.kind==='edit' ? <TrackerEditor creative={editor.creative} taxonomy={taxonomy} schema={m.actions.schema} loadSchema={m.actions.loadSchema} save={m.actions.save} busy={busy} /> : null}
      {editor.kind==='spawn' && editor.creative ? <TrackerSpawn creative={editor.creative} creatives={m.creatives} busy={busy} spawn={m.actions.spawn} schema={m.actions.schema} loadSchema={m.actions.loadSchema} /> : null}
      {editor.kind==='winners' && editor.creative ? <TrackerWinners db={m.db} creative={editor.creative} busy={busy} save={m.actions.winner} share={m.actions.shareWinner} /> : null}
      {editor.kind==='delete' && editor.creative ? <TrackerDelete creative={editor.creative} busy={busy} remove={m.actions.remove} /> : null}
    </> : <>
      <div className={styles.cellTabs} role="tablist" aria-label="Cell views">{(['creatives','add','insights'] as const).map(tab=><button key={tab} role="tab" id={`cell-tab-${tab}`} aria-controls={`cell-panel-${tab}`} aria-label={tab==='add' ? '+ Add Creative' : tab==='creatives' ? 'Creatives' : 'Insights'} aria-selected={m.inspectorTab===tab} type="button" onClick={()=>m.setInspectorTab(tab)}>{tab==='add' ? '+ Add Creative' : tab==='creatives' ? <>Creatives <span>{scope.total}</span></> : 'Insights'}</button>)}</div>
      <section role="tabpanel" id="cell-panel-creatives" aria-labelledby="cell-tab-creatives" hidden={m.inspectorTab!=='creatives'} className={styles.cellCreativePanel}>
        <MatrixInspectorTable model={m} />
        {m.selectedCell?.meta?._excludedCreativeIds?.length ? <details className={styles.cellRemoved}><summary>Removed from cell</summary>{m.creatives.filter(ad=>m.selectedCell?.meta?._excludedCreativeIds?.includes(ad.id)).map(ad=><p key={ad.id}>{ad.formatName} <button type="button" disabled={busy} aria-label={`Restore ${ad.formatName}`} onClick={()=>void m.assignment(ad,true)}><RotateCcw size={16} /></button></p>)}</details> : null}
      </section>
      <section role="tabpanel" id="cell-panel-add" aria-labelledby="cell-tab-add" hidden={m.inspectorTab!=='add'} className={styles.cellAddPanel}><MatrixSourcePicker model={m} /></section>
      <section role="tabpanel" id="cell-panel-insights" aria-labelledby="cell-tab-insights" hidden={m.inspectorTab!=='insights'} className={styles.cellInsightPanel}><MatrixInsights creatives={scope.ads} /></section>
    </>}
  </TrackerDialog>;
}
