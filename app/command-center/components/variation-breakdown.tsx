'use client';
import { useCallback, useId, useRef, useState } from 'react';
import { GitBranch, Plus, X } from 'lucide-react';
import type { planVariationGroups } from '../../../lib/domain/action-plan-variations.js';
import { usePlanMenuPosition } from '../hooks/use-plan-menu-position';
import { variationOutcomes } from '../../../lib/domain/variation-outcomes.js';
import styles from '../../command-center.module.css';

type Group = ReturnType<typeof planVariationGroups>[number];
type Row = { id: string; title: string; status: string; hidden: boolean; actionId: string };
export function VariationBreakdown({ group, spawn, open, busy = false, openCreatives = false }: {
  group?: Group; spawn?: () => void; open?: (id: string, actionId: string) => void; busy?: boolean; openCreatives?: boolean;
}) {
  const id = useId(), trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const dismiss = useCallback(() => { panel.current?.hidePopover(); }, []);
  usePlanMenuPosition(expanded, trigger, panel, dismiss, 380);
  if (!group) return null;
  const counts = variationOutcomes(group.rows);
  return <>
    <button type="button" ref={trigger} popoverTarget={id} aria-expanded={expanded} aria-label={`Variation breakdown for ${group.title}`} title="Variation breakdown" className={styles.variationChip}>
      <GitBranch size={14} />{group.total} · {group.winRate}%
    </button>
    <div ref={panel} id={id} popover="auto" role="dialog" aria-label={`Variation breakdown: ${group.title}`} className={styles.variationPopover}
      onToggle={(event) => setExpanded(event.newState === 'open')}
      onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dismiss(); trigger.current?.focus(); } }}>
      <header><strong>{group.title}</strong><button type="button" aria-label="Close variation breakdown" title="Close variation breakdown" onClick={() => { dismiss(); trigger.current?.focus(); }}><X size={16} /></button></header>
      <div className={styles.variationPopoverScroll}>
        <dl>{[['Total', group.total], ['Win rate', `${group.winRate}%`], ['Winners', counts.winners], ['Testing', counts.testing], ['Losers', counts.losers], ['Pending', counts.pending]].map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}</dl>
        <div className={styles.variationAxisBars}>{group.axes.map((axis: { name: string; wins: number; total: number }) => <label key={axis.name}>{axis.name}<span>{axis.wins}W / {axis.total}T</span><meter min={0} max={axis.total} value={axis.wins} aria-label={`${axis.name} wins`} /></label>)}</div>
        <ul>{group.rows.map((row: Row) => <li key={row.id}>{open && !row.hidden && (row.actionId || openCreatives) ? <button type="button" onClick={() => { dismiss(); open(row.id, row.actionId); }}>{row.title}</button> : <span>{row.title}</span>}<small>{row.status}</small></li>)}</ul>
        {spawn ? <button type="button" disabled={busy} onClick={() => { dismiss(); spawn(); }}><Plus size={15} />Spawn more</button> : null}
      </div>
    </div>
  </>;
}
