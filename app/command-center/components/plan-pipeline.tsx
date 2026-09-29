'use client';
import { RotateCcw } from 'lucide-react';
import type { ActionRecord } from '../types';
import { planPipelineGroups } from '../../../lib/domain/action-plan-layouts.js';
import { planPeopleLabel } from '../../../lib/domain/action-plan-fields.js';
import type { usePlanStatuses } from '../hooks/use-plan-statuses';
import { PlanAgeBadge, type PlanAges } from './plan-age-badge';
import { PlanAnomalyBadges } from './plan-anomaly-badges';
import { PlanVisibilityButton } from './plan-visibility-button';
import type { PlanVisibility } from '../hooks/use-plan-visibility';
import type { PlanCheckpointControl } from '../hooks/use-plan-checkpoint';
import styles from '../../command-center.module.css';

export function PlanPipeline({ listId, actions, allActions, selectedIds, busy, select, open, statusRules, ages, review, now, visibility }: {
  listId: string; actions: ActionRecord[]; allActions: ActionRecord[]; statusRules: ReturnType<typeof usePlanStatuses>; ages: PlanAges;
  review: PlanCheckpointControl; now: number; visibility: PlanVisibility;
  selectedIds: string[]; busy: boolean; select: (ids: string[], checked: boolean) => void; open: (id: string) => void;
}) {
  const { statuses, loading, error, reload } = statusRules;
  const groups = planPipelineGroups(actions, statuses, allActions);
  return <section aria-label="Action Plan pipeline">
    <div className={styles.planViewBar}>
      {loading ? <span role="status">Loading statuses...</span> : null}
      {error ? <span role="status">{error} Local task statuses are shown.</span> : null}
      <button type="button" title="Refresh ClickUp statuses" aria-label="Refresh ClickUp statuses" disabled={!listId || loading} onClick={reload}><RotateCcw size={16} /></button>
    </div>
    <div className={styles.planPipeline} tabIndex={0} role="region" aria-label="Pipeline columns">
      {groups.map((group) => <section key={group.key} className={styles.planPipelineColumn} data-pipeline-status={group.key} aria-label={`${group.label} pipeline column`}>
        <header><h3>{group.label}</h3><span aria-label={`${group.actions.length} tasks`}>{group.actions.length}</span></header>
        <div className={styles.planPipelineCards}>{group.actions.map((action: ActionRecord) => <article key={action.display.dbId} className={styles.planPipelineCard} data-pipeline-task={action.display.dbId}>
          <div><input type="checkbox" aria-label={`Select ${action.display.title}`} checked={selectedIds.includes(action.display.dbId)} disabled={busy} onChange={(e) => select([action.display.dbId], e.target.checked)} />
            <button type="button" aria-label={`Open ${action.display.title}`} onClick={() => open(action.display.dbId)}>{action.display.title || 'Untitled task'}</button></div>
          <p>{[action.display.adType, action.display.funnelStage].filter(Boolean).join(' / ') || 'Manual'}</p>
          <PlanAgeBadge age={ages.get(action.display.dbId)} action={action} review={review} disabled={busy} />
          <PlanAnomalyBadges action={action} now={now} />
          <PlanVisibilityButton action={action} visibility={visibility} disabled={busy} />
          <dl><div><dt>Source</dt><dd>{action.display.source.label || action.display.source.kind}</dd></div>
            <div><dt>Editor</dt><dd>{planPeopleLabel(action.linkedAdMeta, 'editor')}</dd></div>
            <div><dt>Reviewer</dt><dd>{planPeopleLabel(action.linkedAdMeta, 'reviewer')}</dd></div></dl>
        </article>)}</div>
        {!group.actions.length ? <p className={styles.planColumnEmpty}>No tasks</p> : null}
      </section>)}
    </div>
    {!actions.length ? <p className={styles.emptyState}>No Action Plan tasks match these filters.</p> : null}
  </section>;
}
