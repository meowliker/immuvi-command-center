import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, FolderOpen, GitBranch, Pencil, Star, Trash2, Upload } from 'lucide-react';
import { variationCountForCreative } from '../../../lib/domain/creative-tracker.js';
import { AD_TYPES, FUNNEL_STAGES, safeCreativeUrl, trackerDraft } from '../../../lib/domain/tracker-editing.js';
import { workflowStatuses } from '../helpers/creatives';
import { formatDate } from '../helpers/format';
import { useCreativeTracker } from '../hooks/use-creative-tracker';
import type { Creative, MatrixCell, TrackerSort, TrackerSortColumn } from '../types';
import styles from '../../command-center.module.css';
import { useMemo, useState } from 'react';
import { planVariationGroups } from '../../../lib/domain/action-plan-variations.js';
import { canSpawnVariations } from '../../../lib/domain/variation-lab.js';
import { VariationBreakdown } from './variation-breakdown';
import { TrackerHypothesisDialog } from './tracker-hypothesis-dialog';
import { TrackerMatrixUsage } from './tracker-matrix-usage';
import { useProductFieldCatalog } from './product-field-catalog';

const sortColumns: Record<string, TrackerSortColumn> = { 'Format Name': 'formatName', Status: 'status', Created: 'dateCreated' };
const columnWidths = [256, 172, 172, 172, 172, 172, 200, 110, 100, 100, 90, 140, 100, 110, 180, 94];
type Props = { rows: Creative[]; creatives: Creative[]; cells: MatrixCell[]; taxonomy: ReturnType<typeof useCreativeTracker>['taxonomy']; busy: boolean; actions: ReturnType<typeof useCreativeTracker>['actions']; sort: TrackerSort; onSort: (column: TrackerSortColumn) => void };
export function TrackerTable({ rows, creatives, cells, taxonomy, busy, actions, sort, onSort }: Props) {
  const [hypothesisId, setHypothesisId] = useState<string | null>(null);
  const catalog = useProductFieldCatalog();
  const fieldOptions = useMemo(() => Object.fromEntries(['creativeStructure', 'hookType', 'productionStyle'].map((key) => [key,
    [...new Set([...catalog[key].map((option) => option.name), ...creatives.map((creative) => String((creative as Record<string, unknown>)[key] || '')).filter(Boolean)])],
  ])), [catalog, creatives]);
  const groups = useMemo(() => new Map(planVariationGroups(creatives, [], creatives[0]?.productId || '').map((group) => [group.id, group])), [creatives]);
  const link = (url: string, label: string, text: string) => {
    const href = safeCreativeUrl(url);
    const Icon = text === 'Drive Link' ? FolderOpen : ExternalLink;
    return href ? <a className={styles.trackerLinkBadge} data-kind={text} href={href} target="_blank" rel="noopener noreferrer" title={label} aria-label={label}>{text !== 'Inspiration' ? <Icon size={12} aria-hidden="true" /> : null}{text}</a> : '-';
  };
  const field = (creative: Creative, key: string, label: string, choices: string[]) => {
    const value = String((creative as Record<string, unknown>)[key] || '');
    return <select aria-label={`${label} for ${creative.formatName}`} disabled={busy} value={value} onChange={(event) => void actions.save(creative, { ...trackerDraft(creative), [key]: event.target.value }, {}, true)}>
      <option value="">Not set</option>{[...new Set([...choices, value])].filter(Boolean).map((name) => <option key={name}>{name}</option>)}
    </select>;
  };
  return <><div className={styles.trackerTableScroll} tabIndex={0} role="region" aria-label="Creative inventory table"><table className={styles.trackerTable}>
    <colgroup>{columnWidths.map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
    <thead><tr>{['Format Name','Angle','Persona','Structure','Hook','Production style','Hypothesis','Inspiration Link','Drive Link','Type','Funnel','Status','Created','Variations','Matrix Usage','Actions'].map((label) => {
      const column = sortColumns[label];
      const active = column === sort.col;
      const Icon = active ? sort.dir === 1 ? ArrowUp : ArrowDown : ArrowUpDown;
      return <th key={label} scope="col" aria-sort={column ? active ? sort.dir === 1 ? 'ascending' : 'descending' : 'none' : undefined}>
        {column ? <button type="button" className={styles.trackerSortHeader} onClick={() => onSort(column)}
          aria-label={`Sort by ${label === 'Format Name' ? 'name' : label.toLowerCase()}`} title={`Sort ${active && sort.dir === 1 ? 'descending' : 'ascending'}`}>
          {label}<Icon size={14} aria-hidden="true" />
        </button> : label}
      </th>;
    })}</tr></thead>
    <tbody>{rows.map((creative) => <tr key={creative.id} data-creative-id={creative.id} data-task-type={creative.taskType}>
      <td><div className={styles.trackerFormatName}><strong>{creative.formatName || creative.id}</strong>
        {safeCreativeUrl(creative._clickupUrl) ? link(creative._clickupUrl, `Open ${creative.formatName} in ClickUp`, 'ClickUp') : null}
      </div><small>{creative.id}</small>
        {creative.parentAdId ? <small>Parent: {creatives.find((parent) => parent.id === creative.parentAdId)?.formatName || creative.parentAdId}</small> : null}
        {creative.adOrigin === 'Winner Variation' ? <small>Winner variation</small> : null}
        {creative.taskType === 'production' ? <small>Production</small> : null}
        {creative.fromInspoId ? <small>{creative.fromInspoId}</small> : null}
        {creative.sourceFormatId ? <small>From {creative.sourceFormatName || creative.sourceFormatId}</small> : null}
        {Object.keys(creative.pendingClickUp).length ? <small className={styles.trackerPending}>{Object.keys(creative.pendingClickUp).length} pending ClickUp fields</small> : null}
      </td>
      <td>{field(creative,'angle','Angle',taxonomy.angles)}</td><td>{field(creative,'persona','Persona',taxonomy.personas)}</td>
      <td>{field(creative,'creativeStructure','Structure',fieldOptions.creativeStructure)}</td>
      <td>{field(creative,'hookType','Hook',fieldOptions.hookType)}</td>
      <td>{field(creative,'productionStyle','Production style',fieldOptions.productionStyle)}</td>
      <td>{creative.creativeHypothesis ? <button type="button" className={styles.trackerHypothesisPreview}
        aria-label={`View hypothesis for ${creative.formatName || creative.id}`} aria-haspopup="dialog" title="View full hypothesis"
        onClick={() => setHypothesisId(creative.id)}><span>{creative.creativeHypothesis}</span></button> : '-'}</td><td>{link(creative.adLink, `Open inspiration for ${creative.formatName}`, 'Inspiration')}</td><td>{link(creative.driveLink, `Open Drive for ${creative.formatName}`, 'Drive Link')}</td>
      <td>{field(creative,'adType','Type',AD_TYPES)}</td><td>{field(creative,'funnelStage','Funnel',FUNNEL_STAGES)}</td>
      <td>{field(creative,'status','Status',workflowStatuses(creative.status))}</td><td>{formatDate(creative.dateCreated)}</td>
      <td>{groups.has(creative.id) ? <VariationBreakdown openCreatives group={groups.get(creative.id)} busy={busy} spawn={canSpawnVariations(creative) ? () => actions.open('spawn', creative) : undefined}
        open={(id) => { const child = creatives.find((ad) => ad.id === id); if (child) actions.open('edit', child); }} /> : variationCountForCreative(creative,creatives)}</td>
      <td className={styles.trackerMatrixCell}><TrackerMatrixUsage creative={creative} creatives={creatives} cells={cells} taxonomy={taxonomy} /></td>
      <td><div className={styles.trackerButtons}>
        <button type="button" disabled={busy} title="Edit creative" aria-label={`Edit ${creative.formatName}`} onClick={() => actions.open('edit',creative)}><Pencil size={16} /></button>
        {['Winner','Mild Winner','Scale'].includes(creative.status) ? <>
          <button type="button" disabled={busy} title="Create variations or funnel expansion" aria-label={`Spawn from ${creative.formatName}`} onClick={() => actions.open('spawn',creative)}><GitBranch size={16} /></button>
          <button type="button" disabled={busy} title="Winning files" aria-label={`Winning files for ${creative.formatName}`} onClick={() => actions.open('winners',creative)}><Star size={16} /></button>
        </> : null}
        {creative.clickupTaskId ? <button type="button" disabled={busy || !Object.keys(creative.pendingClickUp).length} title="Push pending ClickUp fields" aria-label={`Push changes for ${creative.formatName}`} onClick={() => void actions.push(creative)}><Upload size={16} /></button> : null}
        <button type="button" disabled={busy} title="Delete creative" aria-label={`Delete ${creative.formatName}`} onClick={() => actions.open('delete',creative)}><Trash2 size={16} /></button>
      </div></td>
    </tr>)}</tbody>
  </table>{!rows.length ? <div className={styles.emptyState}>No creatives match your filters.</div> : null}</div>
    {hypothesisId !== null ? <TrackerHypothesisDialog creative={creatives.find((creative) => creative.id === hypothesisId)} onClose={() => setHypothesisId(null)} /> : null}
  </>;
}
