import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown, RotateCcw, X } from 'lucide-react';
import { PLAN_PULSE_PRESETS, applyPulsePeriod, pulsePeriodDraft, pulsePeriodLabel } from '../../../lib/domain/action-plan-pulse-period.js';
import { usePlanMenuPosition } from '../hooks/use-plan-menu-position';
import type { PlanFilters } from './plan-toolbar';
import styles from '../../command-center.module.css';

export function PlanPulsePeriod({ filters, change, now }: { filters: PlanFilters; change: (next: PlanFilters) => void; now: number }) {
  const [open, setOpen] = useState(false), [draft, setDraft] = useState({ from: '', to: '' }), [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const dismiss = useCallback(() => { setOpen(false); setError(''); }, []);
  usePlanMenuPosition(open, trigger, menu, dismiss, 340);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) dismiss(); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open, dismiss]);
  function close() { dismiss(); trigger.current?.focus({ preventScroll: true }); }
  function apply(preset: string) {
    try { change(applyPulsePeriod(filters, preset, draft, now)); close(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Invalid date range.'); }
  }
  return <div ref={root} className={styles.pulsePeriodControl} onBlur={(event) => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) dismiss();
  }} onKeyDown={(event) => { if (open && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } }}>
    <button ref={trigger} type="button" aria-label="Pulse date range" aria-expanded={open} aria-controls={open ? id : undefined}
      data-active={filters.pulseRange} data-preset={filters.pulseRange ? filters.datePreset : 'week'} title={pulsePeriodLabel(filters)}
      onClick={() => { if (open) dismiss(); else { setDraft(pulsePeriodDraft(filters, now)); setError(''); setOpen(true); } }}>
      <CalendarDays size={14} aria-hidden="true" /><span>{pulsePeriodLabel(filters)}</span><ChevronDown size={12} aria-hidden="true" />
    </button>
    {open ? <div ref={menu} id={id} role="group" aria-label="Pulse date options" className={styles.pulsePeriodMenu}>
      <div className={styles.pulsePeriodScroller}><div>
        <div className={styles.pulsePeriodHeading}><strong><CalendarDays size={14} />Custom date range</strong><button type="button" title="Cancel date range" aria-label="Cancel date range" onClick={close}><X size={15} /></button></div>
        <div className={styles.pulsePeriodPresets} role="group" aria-label="Pulse presets">{PLAN_PULSE_PRESETS.map(([value, label]) => <button key={value} type="button" data-pulse-preset={value}
          aria-pressed={filters.pulseRange && filters.datePreset === value} onClick={() => apply(value)}>{label}</button>)}</div>
        <form onSubmit={(event) => { event.preventDefault(); apply('custom'); }} noValidate>
          <div className={styles.pulsePeriodDates}>
            <label>From<input aria-label="Start date" type="date" required value={draft.from} onChange={(event) => { setDraft({ ...draft, from: event.target.value }); setError(''); }} /></label>
            <label>To<input aria-label="End date" type="date" required value={draft.to} onChange={(event) => { setDraft({ ...draft, to: event.target.value }); setError(''); }} /></label>
          </div>
          {error ? <p role="alert">{error}</p> : null}
          <footer><button type="button" aria-label="Reset pulse date range" onClick={() => apply('reset')}><RotateCcw size={13} />Reset to default</button><button type="submit" aria-label="Apply date range"><Check size={13} />Apply</button></footer>
        </form>
      </div></div>
    </div> : null}
  </div>;
}
