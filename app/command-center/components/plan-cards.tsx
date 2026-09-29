import { ExternalLink, RotateCcw, Trash2 } from 'lucide-react';
import { actionPlanBucket, isActionOverdue } from '../../../lib/domain/action-plan.js';
import { planPresentation } from '../../../lib/domain/action-plan-presentation.js';
import type { ActionRecord } from '../types';
import type { useActionPlan } from '../hooks/use-action-plan';
import type { usePlanRecreation } from '../hooks/use-plan-recreation';
import type { PlanVisibility } from '../hooks/use-plan-visibility';
import type { PlanCheckpointControl } from '../hooks/use-plan-checkpoint';
import { creationLocked } from '../services/plan-workflow';
import { PlanAgeBadge, type PlanAges } from './plan-age-badge';
import { PlanPushControl } from './plan-push-control';
import { PlanAnomalyBadges } from './plan-anomaly-badges';
import { PlanVisibilityButton } from './plan-visibility-button';
import styles from '../../command-center.module.css';
import type { ReactNode } from 'react';

export function PlanCards({ rows, plan, repair, ages, review, visibility, now, variationControl }: {
  rows: ActionRecord[]; plan: ReturnType<typeof useActionPlan>; repair: ReturnType<typeof usePlanRecreation>;
  ages: PlanAges; review: PlanCheckpointControl; visibility: PlanVisibility; now: number; variationControl: (action: ActionRecord) => ReactNode;
}) {
  const completed = rows.filter((action) => action.display.status.toLowerCase() === 'complete');
  const active = rows.filter((action) => action.display.status.toLowerCase() !== 'complete');
  if (!rows.length) return <div className={styles.emptyState}>No Action Plan cards match this filter.</div>;
  return <div className={styles.planCards}>
    {[{ label: 'Tasks', rows: active }, { label: 'Completed', rows: completed }].map((group) => group.rows.length ? <section key={group.label} aria-label={group.label}>
      {group.label === 'Completed' ? <h3>Completed ({group.rows.length})</h3> : null}
      {group.rows.map((action) => {
        const d = action.display, detail = planPresentation(action, plan.ageAds, plan.inspirations);
        const job = plan.creationJobs.find((item) => item.ad_id === d.linkedAdId);
        const busy = !!plan.busyAction || visibility.busy || repair.busy, locked = busy || creationLocked(job);
        const editLocked = plan.editingBusy || visibility.busy || repair.busy || creationLocked(job);
        return <article key={d.dbId} data-plan-card={d.dbId} data-bucket={actionPlanBucket(d.status)} className={styles.planCard}>
          <div className={styles.planCardHeading}>
            <input aria-label={`Select ${d.title}`} type="checkbox" disabled={busy} checked={plan.bulk.selectedIds.includes(d.dbId)} onChange={(event) => plan.bulk.select([d.dbId], event.target.checked)} />
            <div><small>{d.linkedAdId || 'Manual task'}</small><button type="button" className={styles.planCardTitle} onClick={() => plan.setSelectedActionId(d.dbId)}>{d.title || 'Untitled action'}</button>
              <p>{[d.angle, d.persona].filter(Boolean).join(' x ')}{d.adType ? ` / ${d.adType}` : ''}{d.funnelStage ? ` / ${d.funnelStage}` : ''}</p>
            </div>
            <PlanAgeBadge age={ages.get(d.dbId)} action={action} review={review} disabled={locked} />
          </div>
          <div className={styles.planCardReferences}>
            {action.payload.tag === 'ai-recommended' ? <span>AI Recommended</span> : null}
            {detail.briefUrl ? <a href={detail.briefUrl} target="_blank" rel="noreferrer">Brief</a> : null}
            {detail.refUrl ? <a href={detail.refUrl} target="_blank" rel="noreferrer">Ref Task</a> : null}
            {detail.sourceUrl ? <a href={detail.sourceUrl} target="_blank" rel="noreferrer">From: {d.source.label}</a> : <span>{detail.source.label}: {d.source.label}</span>}
            {detail.adUrl ? <a href={detail.adUrl} target="_blank" rel="noreferrer">Ad</a> : null}
            {detail.driveUrl ? <a href={detail.driveUrl} target="_blank" rel="noreferrer">Drive</a> : null}
          </div>
          {d.description ? <p className={styles.planCardBrief}>{d.description}</p> : null}
          <PlanAnomalyBadges action={action} now={now} />
          <div className={styles.planCardControls}>
            {variationControl(action)}
            {creationLocked(job) && d.linkedAdId ? <PlanPushControl name={d.title} linked={false} job={job} busy={busy} onPush={(id) => void plan.pushToClickUp(action, id)} />
              : d.clickupTaskDeleted ? (repair.available(action) ? <button type="button" aria-label={`Repair ClickUp link for ${d.title}`} disabled={locked} onClick={() => repair.open(action)}><RotateCcw size={14} />Repair ClickUp link</button> : <span>ClickUp task deleted</span>)
              : detail.clickupUrl ? <a href={detail.clickupUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />ClickUp</a>
                : d.linkedAdId ? <PlanPushControl name={d.title} linked={false} job={job} busy={busy} onPush={(id) => void plan.pushToClickUp(action, id)} /> : null}
            <input aria-label={`Due date for ${d.title}`} className={isActionOverdue(d, now) ? styles.overdueText : undefined} disabled={editLocked} type="date" value={d.dueDate || ''} onChange={(event) => plan.updateDueDate(action, event.target.value)} />
            <select aria-label={`Status for ${d.title}`} disabled={editLocked || plan.statusUnavailable(action)} value={d.status} onChange={(event) => plan.updateStatus(action, event.target.value)}>
              {plan.statusOptions(action).map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <PlanVisibilityButton action={action} visibility={visibility} disabled={locked} />
            <button type="button" onClick={() => plan.setSelectedActionId(d.dbId)}>Details</button>
            {!d.isVirtual ? <button type="button" title={`Remove ${d.title} from Action Plan`} aria-label={`Remove ${d.title} from Action Plan`} disabled={locked} onClick={() => plan.removeFromPlan(action)}><Trash2 size={15} /></button> : null}
          </div>
        </article>;
      })}
    </section> : null)}
  </div>;
}
