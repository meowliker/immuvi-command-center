import type { planRowAge } from '../../../lib/domain/action-plan-health.js';
import styles from '../../command-center.module.css';
import type { ActionRecord } from '../types';
import type { PlanCheckpointControl } from '../hooks/use-plan-checkpoint';

export type PlanAge = ReturnType<typeof planRowAge>;
export type PlanAges = Map<string, PlanAge>;
export function PlanAgeBadge({ age, action, review, disabled }: { age?: PlanAge; action?: ActionRecord; review?: PlanCheckpointControl; disabled?: boolean }) {
  if (!age) return null;
  if (action && review?.available(action)) return <button type="button" className={styles.planAge} data-plan-age={age.state} data-checkpoint={age.phase}
    title={age.tooltip} aria-label={`Review testing for ${action.display.title}`} disabled={disabled} onClick={() => review.open(action)}>{age.label}</button>;
  return <span className={styles.planAge} data-plan-age={age.state} data-checkpoint={age.phase} title={age.tooltip}
    aria-label={`${age.label}${age.state === 'red' ? ', needs attention' : age.state === 'yellow' ? ', approaching threshold' : ''}`}>
    {age.state === 'red' ? '! ' : ''}{age.label}
  </span>;
}
