import { ArrowDown, ArrowUp, ExternalLink, PanelRightOpen, Lightbulb, Repeat2, GitBranch, Pencil, Hand, Clapperboard, Palette, Trash2, Circle, ChevronDown, RefreshCw } from 'lucide-react';
import { PlanTitleEditor } from './plan-title-editor';
import { PlanFieldControl } from './plan-field-control';
import { PlanColumnResizer } from './plan-column-resizer';
import { useState } from 'react';
import { PlanAgeBadge, type PlanAges } from './plan-age-badge';
import { PlanAnomalyBadges } from './plan-anomaly-badges';
import { PlanVisibilityButton } from './plan-visibility-button';
import type { PlanVisibility } from '../hooks/use-plan-visibility';
import type { PlanCheckpointControl } from '../hooks/use-plan-checkpoint';
import { planColumn } from '../../../lib/domain/action-plan-views.js';
import { planLink, planSourceLabel, planPresentation } from '../../../lib/domain/action-plan-presentation.js';
import { isActionOverdue } from '../../../lib/domain/action-plan.js';
import { formatCreatedAge, formatDateTime } from '../helpers/format';
import { PlanPushControl } from './plan-push-control';
import { creationLocked } from '../services/plan-workflow';
import type { useActionPlan } from '../hooks/use-action-plan';
import type { usePlanDeletion } from '../hooks/use-plan-deletion';
import type { usePlanRecreation } from '../hooks/use-plan-recreation';
import type { PlanColumnState } from '../hooks/use-plan-views';
import type { ActionRecord } from '../types';
import styles from '../../command-center.module.css';
import type { ReactNode } from 'react';

export type PlanSort = { key: string; direction: 1 | -1 };
const sourceIcons: Record<string, typeof Hand> = { inspo: Lightbulb, tracker: Repeat2, variation: GitBranch, blank: Pencil, adopted: Clapperboard };
export function PlanTable({ rows, plan, sort, setSort, columns, resizeColumn, resizingDisabled, ages, review, now, visibility, variationControl, producerControl, deletion, repair }: { rows: ActionRecord[]; plan: ReturnType<typeof useActionPlan>; sort: PlanSort; setSort: (sort: PlanSort) => void; columns: PlanColumnState[]; resizeColumn: (key: string, width: number) => Promise<void>; resizingDisabled: boolean; ages: PlanAges; review: PlanCheckpointControl; now: number; visibility: PlanVisibility; variationControl: (action: ActionRecord) => ReactNode; producerControl: (action: ActionRecord) => ReactNode; deletion: ReturnType<typeof usePlanDeletion>; repair: ReturnType<typeof usePlanRecreation> }) {
  const [draft, setDraft] = useState<{ key: string; width: number } | null>(null);
  const visible = columns.filter((column) => !column.hidden).map((column) => draft && column.key === draft.key ? { ...column, width: draft.width } : column);
  async function commitWidth(key: string, width: number) {
    setDraft({ key, width });
    try { await resizeColumn(key, width); } finally { setDraft(null); }
  }
  const width = visible.reduce((sum, column) => sum + column.width, 0);
  function content(key: string, action: ActionRecord) {
    const d = action.display, job = plan.creationJobs.find((j) => j.ad_id === d.linkedAdId);
    const disabled = !!plan.busyAction || deletion.busy || repair.busy || creationLocked(job);
    const editDisabled = plan.editingBusy || deletion.busy || repair.busy || creationLocked(job);
    switch (key) {
      case 'cb': return <input aria-label={`Select ${d.title}`} type="checkbox" disabled={!!plan.busyAction} checked={plan.bulk.selectedIds.includes(d.dbId)} onChange={(e) => plan.bulk.select([d.dbId], e.target.checked)} />;
      case 'source': {
        const source = planSourceLabel(action), Icon = sourceIcons[source.kind] || Hand;
        return <span className={styles.planSourceIcon} data-source={source.kind} title={`${source.label}: ${d.source.label}`} aria-label={source.label}><Icon size={16} /></span>;
      }
      case 'title': return <><div className={styles.planNameLine}><button type="button" className={styles.planTaskName} title={d.title} onClick={() => plan.setSelectedActionId(d.dbId)}><span>{d.title}</span><PanelRightOpen size={13} /></button><PlanTitleEditor action={action} busy={editDisabled} save={plan.saveCreative} /></div><PlanAnomalyBadges action={action} now={now} /></>;
      case 'status': return <><div className={styles.planStatusChip} data-status={d.status.toLowerCase()}><Circle size={11} aria-hidden="true" /><select aria-label={`Status for ${d.title}`} value={d.status} disabled={editDisabled || plan.statusUnavailable(action)} onChange={(e) => void plan.updateStatus(action, e.target.value)}>{plan.statusOptions(action).map((status) => <option key={status}>{status}</option>)}</select><ChevronDown size={9} aria-hidden="true" /></div>
        {!plan.busyAction && d.clickupTaskId && Object.keys((action.linkedAdMeta._trackerPending || {}) as object).length ? <button type="button" className={styles.planPendingSync} disabled={disabled} aria-label={`Retry pending ClickUp changes for ${d.title}`} title="Saved locally, not yet synced to ClickUp. Retry pending changes." onClick={() => void plan.retryClickUp(action)}><RefreshCw size={14} /></button> : null}</>;
      case 'age': return <PlanAgeBadge age={ages.get(d.dbId)} action={action} review={review} disabled={disabled} />;
      case 'due': return <input type="date" aria-label={`Due date for ${d.title}`} value={d.dueDate || ''} disabled={editDisabled} onChange={(e) => void plan.updateDueDate(action, e.target.value)} />;
      case 'editor': case 'reviewer': return <PlanFieldControl name={key === 'editor' ? 'Editor' : 'Reviewer'} action={action} plan={plan} disabled={editDisabled} />;
      case 'cell': return <><span>{d.angle || '-'}</span><small>{d.persona || '-'}</small></>;
      case 'angle': case 'persona': return <PlanFieldControl name={key === 'angle' ? 'Angle' : 'Persona'} action={action} plan={plan} disabled={editDisabled} />;
      case 'origin': {
        const detail = planPresentation(action, plan.ageAds, plan.inspirations), label = detail.originLabel;
        return <span className={styles.planOriginChip} data-source={detail.source.kind} title={label}>{detail.sourceUrl ? <a href={detail.sourceUrl} target="_blank" rel="noreferrer">{label}<ExternalLink size={10} /></a> : label}</span>;
      }
      case 'brief': case 'adSource': case 'driveLink': {
        const detail = planPresentation(action, plan.ageAds, plan.inspirations);
        const [label, url] = key === 'brief' ? ['Brief', detail.briefUrl] : key === 'adSource' ? ['Ad source', detail.adSourceUrl] : ['Drive Link', detail.clickupDriveUrl];
        return url ? <a className={styles.planClickUpLink} href={url} title={url} aria-label={`${label} for ${d.title}`} target="_blank" rel="noreferrer"><ExternalLink size={12} />{label}</a> : '-';
      }
      case 'funnel': return d.funnelStage || '-';
      case 'type': return d.adType || '-';
      case 'hook': return d.hookType || '-';
      case 'created': return <span title={formatDateTime(d.createdAt) || undefined}>{formatCreatedAge(d.createdAt, now)}</span>;
      case 'producer': return producerControl(action);
      case 'del': return <div className={styles.planTableLinks}>
        <PlanVisibilityButton action={action} visibility={visibility} disabled={disabled} />
        <button type="button" className={styles.planFieldsButton} title="Delete creative" aria-label={`Delete creative ${d.title}`} disabled={disabled || !deletion.available(action)} onClick={() => deletion.open(action)}><Trash2 size={15} /></button>
        {variationControl(action)}
      </div>;
      case 'clickup': return creationLocked(job) ? <PlanPushControl compact name={d.title} linked={false} job={job} busy={!!plan.busyAction} onPush={(taskId) => void plan.pushToClickUp(action, taskId)} />
        : d.clickupTaskDeleted ? <button type="button" className={styles.planRepairLink} disabled={disabled || !repair.available(action)} onClick={() => repair.open(action)}>Recreate</button>
          : planLink(d.clickupUrl) ? <a className={styles.planClickUpLink} href={planLink(d.clickupUrl)} target="_blank" rel="noreferrer"><ExternalLink size={12} />ClickUp</a>
            : d.linkedAdId ? <PlanPushControl compact name={d.title} linked={!!d.clickupTaskId} job={job} busy={disabled} onPush={(taskId) => void plan.pushToClickUp(action, taskId)} /> : '-';
      default: return <PlanFieldControl name={key.slice(3)} action={action} plan={plan} disabled={editDisabled} />;
    }
  }
  return <div className={styles.planTableScroll} tabIndex={0} role="region" aria-label="Action Plan tasks">
    <table className={styles.planTable} style={{ width, minWidth: width }}>
      <colgroup>{visible.map((column) => <col key={column.key} style={{ width: column.width }} />)}</colgroup>
      <thead><tr>{visible.map((column) => {
        const definition = planColumn(column.key)!, key = definition.sort, active = key === sort.key;
        return <th key={column.key} scope="col" data-plan-column={column.key} aria-sort={key ? active ? sort.direction === 1 ? 'ascending' : 'descending' : 'none' : undefined}>
          {column.key === 'cb' ? <input type="checkbox" aria-label="Select all table tasks" disabled={!!plan.busyAction || !rows.length} checked={rows.length > 0 && rows.every(action => plan.bulk.selectedIds.includes(action.display.dbId))} onChange={e => plan.bulk.select(rows.map(action => action.display.dbId), e.target.checked)} />
            : column.key === 'producer' ? <Palette size={15} aria-label="Producer" />
              : key ? <button type="button" onClick={() => setSort({ key, direction: active && sort.direction === 1 ? -1 : 1 })}>{definition.label}{active ? sort.direction === 1 ? <ArrowUp size={13} /> : <ArrowDown size={13} /> : null}</button> : <span>{definition.label}</span>}
          <PlanColumnResizer label={definition.label} width={column.width} min={definition.min} disabled={resizingDisabled}
            preview={(width) => setDraft(width === null ? null : { key: column.key, width })}
            commit={(width) => void commitWidth(column.key, width)} />
        </th>;
      })}</tr></thead>
      <tbody>{rows.map((action) => <tr key={plan.presentationKeys.get(action.display.dbId)} data-plan-row={action.display.dbId} data-age={ages.get(action.display.dbId)?.state} data-plan-hidden={visibility.hiddenIds.has(action.display.linkedAdId)} data-selected={plan.bulk.selectedIds.includes(action.display.dbId)}
        onClick={event => { if (!(event.target as HTMLElement).closest('button, input, select, textarea, a, [popover], [role="dialog"]')) plan.setSelectedActionId(action.display.dbId); }}>
        {visible.map((column) => <td key={column.key} data-plan-cell={column.key} className={column.key === 'due' && isActionOverdue(action.display) ? styles.overdueText : undefined}>{content(column.key, action)}</td>)}
      </tr>)}</tbody>
    </table>
    {!rows.length ? <div className={styles.emptyState}>No Action Plan tasks match these filters.</div> : null}
  </div>;
}
