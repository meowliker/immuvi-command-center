import { Eye, EyeOff } from 'lucide-react';
import type { ActionRecord } from '../types';
import type { PlanVisibility } from '../hooks/use-plan-visibility';
import styles from '../../command-center.module.css';

export function PlanVisibilityButton({ action, visibility, disabled }: { action: ActionRecord; visibility: PlanVisibility; disabled?: boolean }) {
  const id = action.display.linkedAdId;
  if (!id) return null;
  const hidden = visibility.hiddenIds.has(id);
  const label = `${hidden ? 'Restore' : 'Hide'} ${action.display.title} ${hidden ? 'in' : 'from'} my plan`;
  return <button className={styles.planVisibilityButton} type="button" aria-label={label} title={label}
    disabled={disabled || !visibility.ready || visibility.busy} onClick={() => void visibility.change(id, !hidden)}>
    {hidden ? <><Eye size={15} /><span>Hidden</span></> : <EyeOff size={15} />}
  </button>;
}
