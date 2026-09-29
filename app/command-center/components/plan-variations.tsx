import { useMemo, useState } from 'react';
import { ExternalLink, GitBranch, Plus, Trophy } from 'lucide-react';
import { canSpawnVariations } from '../../../lib/domain/variation-lab.js';
import { VariationBreakdown } from './variation-breakdown';
import { planVariationGroups } from '../../../lib/domain/action-plan-variations.js';
import type { normalizeActionAd } from '../../../lib/domain/action-plan.js';
import type { ActionRecord } from '../types';
import styles from '../../command-center.module.css';

export function PlanVariations({ ads, actions, productId, hiddenIds, loaded, error, open, spawn, busy }: {
  ads: ReturnType<typeof normalizeActionAd>[]; actions: ActionRecord[]; productId: string;
  hiddenIds: Set<string>; loaded: boolean; error: string; open: (id: string) => void; spawn: (id: string) => void; busy: boolean;
}) {
  const groups = useMemo(() => planVariationGroups(ads, actions, productId, hiddenIds), [ads, actions, productId, hiddenIds]);
  const [parentId, setParentId] = useState('');
  const parents = ads.filter((ad) => ad.productId === productId && canSpawnVariations(ad) && !hiddenIds.has(ad.id));
  const selected = parents.some((ad) => ad.id === parentId) ? parentId : parents[0]?.id || '';
  return <section className={styles.planVariations} aria-label="Action Plan variations">
    <header><h3>Variations</h3><span>All product variations</span></header>
    {loaded ? <div className={styles.variationCreate}><label>Winning creative<select aria-label="Winning creative" value={selected} onChange={(event) => setParentId(event.target.value)} disabled={!parents.length || busy}>
      {!parents.length ? <option value="">No eligible winners</option> : parents.map((ad) => <option key={ad.id} value={ad.id}>{ad.formatName || ad.id}</option>)}
    </select></label><button type="button" disabled={!selected || busy} onClick={() => spawn(selected)}><Plus size={16} />Create variations</button></div> : null}
    {!loaded ? <p role="status">{error ? 'Variations unavailable.' : 'Loading variations...'}</p>
      : !groups.length ? <div className={styles.emptyState}>No variations yet.</div>
      : groups.map((group) => <section key={group.id} className={styles.planVariationGroup} data-variation-group={group.id} aria-label={`Variations of ${group.title}`}>
        <header><h4>{group.winner ? <Trophy size={15} aria-label="Winner" /> : null}{group.title}</h4>
          <span className={styles.planVariationTotal}><GitBranch size={15} aria-hidden="true" />{group.total} {group.total === 1 ? 'variation' : 'variations'} <strong data-variation-win-rate>{group.winRate}% won</strong></span>
          <VariationBreakdown group={group} busy={busy} spawn={parents.some((ad) => ad.id === group.id) ? () => spawn(group.id) : undefined} open={(_, actionId) => { if (actionId) open(actionId); }} />
          <div className={styles.planVariationAxes}>{group.axes.map((axis: { name: string; wins: number; total: number }) => <span key={axis.name} title={`${axis.name}: ${axis.wins} wins / ${axis.total} variations`}>{axis.name} {axis.wins}W/{axis.total}T</span>)}</div>
        </header>
        <div className={styles.planVariationScroll} role="region" aria-label={`${group.title} variation table`} tabIndex={0}>
          <table><thead><tr>{['Variation', 'Axis', 'Status', 'Editor', 'Due', 'ClickUp'].map((name) => <th scope="col" key={name}>{name}</th>)}</tr></thead>
            <tbody>{group.rows.map((row: { id: string; title: string; axes: string; status: string; editor: string; dueDate: string; clickupUrl: string; actionId: string; hidden: boolean }) => <tr key={row.id} data-variation-row={row.id}>
              <th scope="row">{row.actionId ? <button type="button" onClick={() => open(row.actionId)} aria-label={`Open variation ${row.title}`}>{row.title}</button> : row.title}{row.hidden ? <small>Hidden from my plan</small> : null}</th>
              <td>{row.axes}</td><td><span className={styles.planVariationStatus} data-status={row.status.toLowerCase()}>{row.status}</span></td>
              <td>{row.editor}</td><td>{row.dueDate || '-'}</td><td>{row.clickupUrl ? <a href={row.clickupUrl} target="_blank" rel="noreferrer" aria-label={`ClickUp for ${row.title}`}><ExternalLink size={13} />ClickUp</a> : '-'}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>)}
  </section>;
}
