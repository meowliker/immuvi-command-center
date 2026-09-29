import { useMemo } from 'react';
import { FilePlus2, FilePenLine, Wrench, CircleCheck, Rocket, Scale, FlaskConical, Trophy, CircleSlash } from 'lucide-react';
import { planPulse, togglePlanPulse, latestPlanActivity, PLAN_PULSE_TODAY, PLAN_PULSE_PERIOD, PLAN_PULSE_LABELS } from '../../../lib/domain/action-plan-pulse.js';
import { applyPulsePeriod, pulsePeriodLabel } from '../../../lib/domain/action-plan-pulse-period.js';
import { PlanPulsePeriod } from './plan-pulse-period';
import type { PlanFilters } from './plan-toolbar';
import type { ActionRecord } from '../types';
import styles from '../../command-center.module.css';

const icons = { created: FilePlus2, briefed: FilePenLine, production: Wrench, ready: CircleCheck, launched: Rocket, decisions: Scale, tested: FlaskConical, decided: Scale, winners: Trophy, killed: CircleSlash };
export function PlanPulse({ actions, filters, change, now }: { actions: ActionRecord[]; filters: PlanFilters; change: (next: PlanFilters) => void; now: number }) {
  const counts = useMemo(() => planPulse(actions, filters, now), [actions, filters.pulseRange, filters.datePreset, filters.dateFrom, filters.dateTo, now]);
  const period = pulsePeriodLabel(filters);
  const allTime = filters.pulseRange && filters.datePreset === 'all';
  const latest = useMemo(() => latestPlanActivity(actions), [actions]);
  return <section className={styles.planPulse} aria-label="Action Plan pulse">
    {(['today', 'week'] as const).map((scope) => {
      const selectedMetrics = scope === 'today' ? PLAN_PULSE_TODAY : PLAN_PULSE_PERIOD;
      const total = PLAN_PULSE_TODAY.reduce((sum, key) => sum + counts[scope][key], 0);
      return <div className={styles.planPulsePeriod} key={scope}>
        <header><div><h3>{scope === 'today' ? 'Today' : period}</h3>{scope === 'week' ? <small className={styles.pulsePeriodComparison}>{allTime ? 'Current totals across all task dates' : 'vs prior period of equal length'}</small> : null}</div>{scope === 'today' ? <time>{new Date(now).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</time> : <PlanPulsePeriod filters={filters} change={change} now={now} />}</header>
        <div className={styles.planPulseTiles}>{selectedMetrics.map((metric) => {
          const key = `${scope}:${metric}`, label = PLAN_PULSE_LABELS[metric as keyof typeof PLAN_PULSE_LABELS], Icon = icons[metric as keyof typeof icons];
          const delta = counts.delta[metric];
          return <button type="button" key={metric} data-pulse-key={key} data-metric={metric} aria-label={`${scope === 'today' ? 'Today' : 'Period'} ${label}`} aria-pressed={filters.pulseKeys.includes(key)} onClick={() => change(togglePlanPulse(filters, key))}>
            <Icon size={17} /><span>{label}<strong data-pulse-count>{counts[scope][metric]}</strong></span>
            {scope === 'week' && !allTime && metric !== 'tested' ? <small title="Change versus prior period of equal length" aria-label={`Change ${delta > 0 ? '+' : ''}${delta} versus prior period`}>{delta > 0 ? '+' : ''}{delta}</small> : null}
          </button>;
        })}</div>
        <div className={styles.planPulseDistribution} aria-label={`${scope === 'today' ? 'Today' : 'Period'} activity distribution`}>
          {total ? PLAN_PULSE_TODAY.filter((metric) => counts[scope][metric]).map((metric) => <span key={metric} data-metric={metric} style={{ flexGrow: counts[scope][metric] }} title={`${PLAN_PULSE_LABELS[metric as keyof typeof PLAN_PULSE_LABELS]}: ${counts[scope][metric]}`} />) : <small>{actions.length ? `No activity in this period${latest ? `. Last activity: ${new Date(latest).toLocaleDateString()}` : '. Activity dates unavailable'}` : 'No activity yet'}</small>}
        </div>
        {scope === 'week' && !total && actions.length > 0 && !allTime ? <button type="button" className={styles.pulseAllTimeShortcut} onClick={() => change(applyPulsePeriod(filters, 'all', null, now))}>View all-time totals ({actions.length})</button> : null}
      </div>;
    })}
  </section>;
}
