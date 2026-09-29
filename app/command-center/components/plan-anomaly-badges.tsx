import { planAnomalies } from '../../../lib/domain/action-plan-filters.js';
import type { ActionRecord } from '../types';
import styles from '../../command-center.module.css';

export function PlanAnomalyBadges({ action, now }: { action: ActionRecord; now: number }) {
  const badges = planAnomalies(action, now);
  if (!badges.length) return null;
  return <div className={styles.planAnomalies} aria-label={`Anomalies for ${action.display.title}`}>
    {badges.map((badge) => <span key={badge.type} data-anomaly={badge.type} data-tone={badge.tone} title={badge.tip}>{badge.label}</span>)}
  </div>;
}
