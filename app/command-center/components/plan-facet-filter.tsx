import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowDownToLine, ChevronDown, CircleDot, Filter, RotateCcw, Tag, Target, Users } from 'lucide-react';
import { PLAN_FACET_LABELS, planFacetMatches } from '../../../lib/domain/action-plan-filters.js';
import styles from '../../command-center.module.css';
import { usePlanMenuPosition } from '../hooks/use-plan-menu-position';

export type PlanFacetKey = keyof typeof PLAN_FACET_LABELS;
export function PlanFacetFilter({ facet, values, options, toggle, clear }: {
  facet: PlanFacetKey; values: string[]; options: string[]; toggle: (value: string) => void; clear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const dismiss = useCallback(() => setOpen(false), []);
  const id = useId(), label = PLAN_FACET_LABELS[facet];
  const Icon = { status: CircleDot, angle: Target, persona: Users, funnelStage: Filter, adType: Tag, source: ArrowDownToLine }[facet];
  usePlanMenuPosition(open, trigger, menu, dismiss);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return <div ref={root} className={styles.planFacet} onBlur={(event) => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
  }} onKeyDown={(event) => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
  }}>
    <button ref={trigger} type="button" aria-label={`Filter ${facet}`} title={values.length ? `${label}: ${values.join(', ')}` : `All ${label.toLowerCase()} values`} data-active={values.length > 0} aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open)}>
      <Icon size={14} aria-hidden="true" /><span>{label}</span><strong>{values.length || ''}</strong><ChevronDown size={12} />
    </button>
    {open ? <div ref={menu} id={id} role="group" aria-label={`${label} options`} className={styles.planFacetMenu}>
      <header><strong>{label}</strong><button type="button" aria-label={`Clear ${label} filter`} title={`Clear ${label} filter`} disabled={!values.length} onClick={clear}><RotateCcw size={14} /></button></header>
      <div className={styles.planFacetOptions}>{options.map((value) => <label key={value}>
        <input type="checkbox" checked={values.length > 0 && planFacetMatches(value, values, facet)} onChange={() => toggle(value)} /><span>{value}</span>
      </label>)}{!options.length ? <p>No values</p> : null}</div>
    </div> : null}
  </div>;
}
