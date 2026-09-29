import { actionPlanBucket } from '../../../lib/domain/action-plan.js';
import { creativeStatusBucket } from '../../../lib/domain/creative-tracker.js';
import styles from '../../command-center.module.css';

function actionStatusClass(status: string, css: typeof styles) {
  const bucket = actionPlanBucket(status);
  if (bucket === 'winners') return css.activeBadge;
  if (bucket === 'losers') return css.inactiveBadge;
  if (bucket === 'production' || bucket === 'testing') return css.roleMember;
  return css.pendingBadge;
}

export function creativeStatusClass(status: string, css: typeof styles) {
  const bucket = creativeStatusBucket(status);
  if (bucket === 'winner') return css.activeBadge;
  if (bucket === 'loser') return css.inactiveBadge;
  if (bucket === 'testing' || bucket === 'ready') return css.roleMember;
  return css.pendingBadge;
}

export function queueStatusClass(status: string, css: typeof styles) {
  if (status === 'pending') return css.pendingBadge;
  if (['claimed', 'classifying', 'processing'].includes(status)) return css.roleMember;
  if (['classified', 'done'].includes(status)) return css.activeBadge;
  if (['failed', 'error'].includes(status)) return css.inactiveBadge;
  return css.pendingBadge;
}

export function workerHealthClass(health: string, css: typeof styles) {
  if (['online', 'busy'].includes(health)) return css.activeBadge;
  if (health === 'paused') return css.pendingBadge;
  return css.inactiveBadge;
}
