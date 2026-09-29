import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown, X } from 'lucide-react';
import { PLAN_DATE_PRESETS, planDateRange } from '../../../lib/domain/action-plan-dates.js';
import { usePlanMenuPosition } from '../hooks/use-plan-menu-position';
import type { PlanFilters } from './plan-toolbar';
import styles from '../../command-center.module.css';

export function PlanDateFilter({ filters, change }: { filters: PlanFilters; change: (next: PlanFilters) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ from: string; to: string } | null>(null);
  const [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const dismiss = useCallback(() => { setOpen(false); setDraft(null); setError(''); }, []);
  usePlanMenuPosition(open, trigger, menu, dismiss, 340);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) dismiss(); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open, dismiss]);
  function close() { dismiss(); trigger.current?.focus({ preventScroll: true }); }
  function commit(next: PlanFilters) { change({ ...next, pulseRange: false, pulseKeys: [] }); }
  function choose(preset: string) {
    if (preset === 'custom') { setDraft({ from: filters.dateFrom, to: filters.dateTo }); setError(''); return; }
    commit({ ...filters, datePreset: preset }); close();
  }
  function apply(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const next = { ...filters, datePreset: 'custom', dateFrom: draft.from, dateTo: draft.to };
    const range = planDateRange(next);
    if (range.error) { setError(range.error); return; }
    commit(next); close();
  }
  const label = PLAN_DATE_PRESETS.find(([value]) => value === filters.datePreset)?.[1] || 'All time';
  return <div ref={root} className={styles.planDateFilter} onBlur={(event) => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) dismiss();
  }} onKeyDown={(event) => {
    if (open && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
  }}>
    <button ref={trigger} type="button" aria-label="Action Plan date range" aria-expanded={open} aria-controls={open ? id : undefined}
      data-preset={filters.datePreset} data-active={filters.datePreset !== 'all'}
      title={filters.datePreset === 'custom' ? `${filters.dateFrom} to ${filters.dateTo}` : label}
      onClick={() => { if (open) dismiss(); else { setOpen(true); if (filters.datePreset === 'custom') setDraft({ from: filters.dateFrom, to: filters.dateTo }); } }}>
      <CalendarDays size={14} aria-hidden="true" /><span>Date</span><strong>{label}</strong><ChevronDown size={12} aria-hidden="true" />
    </button>
    {open ? <div ref={menu} id={id} role="group" aria-label="Action Plan date options" className={`${styles.planFacetMenu} ${styles.planDateMenu}`}>
      <div className={styles.planDateScroller}><div>
        <div className={styles.planDatePresets}>{PLAN_DATE_PRESETS.map(([value, text]) => <button key={value} type="button" data-date-preset={value}
          aria-pressed={(draft ? 'custom' : filters.datePreset) === value} onClick={() => choose(value)}>{text}</button>)}</div>
        {draft ? <form onSubmit={apply} noValidate className={styles.planDateCustom}>
          <label>From<input aria-label="Start date" type="date" required value={draft.from} onChange={(event) => { setDraft({ ...draft, from: event.target.value }); setError(''); }} /></label>
          <label>To<input aria-label="End date" type="date" required value={draft.to} onChange={(event) => { setDraft({ ...draft, to: event.target.value }); setError(''); }} /></label>
          {error ? <p role="alert">{error}</p> : null}
          <footer><button type="button" onClick={close}><X size={14} />Cancel date range</button><button type="submit"><Check size={14} />Apply date range</button></footer>
        </form> : null}
        <div className={styles.planDateCompare}><span>Compare against</span><div role="group" aria-label="Date basis">
          <button type="button" title="Status moved within the period" aria-pressed={filters.dateMode === 'window'} onClick={() => commit({ ...filters, dateMode: 'window' })}>Activity</button>
          <button type="button" title="Task was created within the period" aria-pressed={filters.dateMode === 'lifetime'} onClick={() => commit({ ...filters, dateMode: 'lifetime' })}>Created</button>
        </div></div>
      </div></div>
    </div> : null}
  </div>;
}
