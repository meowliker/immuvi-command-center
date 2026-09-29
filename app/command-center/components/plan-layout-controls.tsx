import { CalendarDays, ChartColumn, Columns3, GitBranch, LayoutList, Table2 } from 'lucide-react';
import type { PlanLayout } from './plan-toolbar';
import styles from '../../command-center.module.css';

const layouts = [
  ['table', 'Table', Table2], ['cards', 'Cards', LayoutList],
  ['pipeline', 'Pipeline', Columns3], ['week', 'Week', CalendarDays],
  ['trends', 'Trends', ChartColumn],
  ['variations', 'Variations', GitBranch],
] as const;

export function PlanLayoutControls({ view, change }: { view: PlanLayout; change: (view: PlanLayout) => void }) {
  return <div className={styles.planLayouts} role="group" aria-label="Action Plan layout">
    {layouts.map(([id, label, Icon]) => <button key={id} type="button" title={label} aria-label={`${label} view`}
      aria-pressed={view === id} onClick={() => change(id)}><Icon size={16} /><span>{label}</span></button>)}
  </div>;
}
