import { X } from 'lucide-react';
import { PLAN_DATE_PRESETS } from '../../../lib/domain/action-plan-dates.js';
import { PLAN_PULSE_LABELS, togglePlanPulse } from '../../../lib/domain/action-plan-pulse.js';
import type { PlanFilters } from './plan-toolbar';
import { PLAN_FACETS, PLAN_FACET_LABELS, togglePlanFacet } from '../../../lib/domain/action-plan-filters.js';
import type { PlanFacetKey } from './plan-facet-filter';
import styles from '../../command-center.module.css';

export function PlanFilterChips({ filters, change, reset }: { filters: PlanFilters; change: (next: PlanFilters) => void; reset: () => void }) {
  const chips: { label: string; clear: () => void }[] = [];
  const labels = { query: 'Search', due: 'Due' };
  for (const key of Object.keys(labels) as (keyof typeof labels)[]) {
    if (filters[key]) chips.push({ label: `${labels[key]}: ${filters[key]}`, clear: () => change({ ...filters, [key]: '' }) });
  }
  for (const key of PLAN_FACETS as PlanFacetKey[]) for (const value of filters[key]) {
    chips.push({ label: `${PLAN_FACET_LABELS[key]}: ${value}`, clear: () => change(togglePlanFacet(filters, key, value)) });
  }
  if (filters.datePreset !== 'all') chips.push({ label: `Date: ${filters.datePreset === 'custom' ? `${filters.dateFrom} to ${filters.dateTo}` : PLAN_DATE_PRESETS.find(([key]) => key === filters.datePreset)?.[1] || filters.datePreset}`, clear: () => change({ ...filters, datePreset: 'all', dateFrom: '', dateTo: '', pulseRange: false, pulseKeys: [] }) });
  if (filters.attentionOnly) chips.push({ label: 'Needs attention', clear: () => change({ ...filters, attentionOnly: false }) });
  if (filters.anomaliesOnly) chips.push({ label: 'Anomalies only', clear: () => change({ ...filters, anomaliesOnly: false }) });
  if (filters.showHidden) chips.push({ label: 'Show hidden', clear: () => change({ ...filters, showHidden: false }) });
  if (!filters.includeAdopted) chips.push({ label: 'App-only', clear: () => change({ ...filters, includeAdopted: true }) });
  for (const key of filters.pulseKeys) {
    const [scope, metric] = key.split(':');
    chips.push({ label: `${scope === 'today' ? 'Today' : filters.pulseRange ? 'Period' : 'Week'}: ${PLAN_PULSE_LABELS[metric as keyof typeof PLAN_PULSE_LABELS]}`, clear: () => change(togglePlanPulse(filters, key)) });
  }
  if (!chips.length) return null;
  return <div className={styles.planFilterChips} aria-label="Active Action Plan filters">
    {chips.map(({ label, clear }) => <span key={label}>{label}<button type="button" title={`Remove ${label} filter`} aria-label={`Remove ${label} filter`} onClick={clear}><X size={14} /></button></span>)}
    <button type="button" onClick={reset}>Clear all filters</button>
  </div>;
}
