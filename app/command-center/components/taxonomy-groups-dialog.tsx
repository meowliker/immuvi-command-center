'use client';

import { useId, useState } from 'react';
import { ArrowUpRight, ChevronDown, ClipboardList, ExternalLink, Palette } from 'lucide-react';
import { safeCreativeUrl } from '../../../lib/domain/tracker-editing.js';
import { isCreativeTrackerVisible } from '../../../lib/domain/creative-tracker.js';
import { taxonomyKey, taxonomyStats } from '../../../lib/domain/taxonomy.js';
import type { taxonomyRelationships } from '../../../lib/domain/taxonomy-workspace.js';
import type { TaxonomyKind, TaxonomyRow } from '../types';
import { TrackerDialog } from './tracker-dialog';
import { TaxonomyPopupStatus as Status } from './taxonomy-popup-status';
import styles from '../../command-center.module.css';

export function TaxonomyGroupsDialog({ kind, row, relation, error, onClose, openCreative }: {
  kind: TaxonomyKind; row?: TaxonomyRow; relation?: ReturnType<typeof taxonomyRelationships>; error: string;
  onClose: () => void; openCreative: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState('');
  const [showAll, setShowAll] = useState(false);
  const id = useId();
  const opposite = kind === 'angle' ? 'persona' : 'angle';
  const label = opposite === 'persona' ? 'Personas' : 'Angles';
  return <TrackerDialog title={`${label} \u2014 ${row?.name || 'Unavailable'}`} className={styles.anglePersonasDialog} busy={false}
    error={error ? `${error} Showing the last successful snapshot.` : ''} onClose={onClose} closeLabel="Close relationships">
    {!row || !relation ? <p role="status">This taxonomy record is no longer available.</p> : <>
      <p className={styles.personaDialogSubtitle}>{relation.groups.length} {opposite}{relation.groups.length === 1 ? '' : 's'}</p>
      <ul className={styles.personaAccordion} aria-label="Related taxonomy">
        {relation.groups.map((group, index) => {
          const open = expanded === group.key;
          const stats = taxonomyStats(opposite, group.name, group.creatives.map((ad) => ({ ...ad, [opposite]:group.name })));
          const source = safeCreativeUrl(group.row?.sourceLink);
          const panelId = `${id}-panel-${index}`, headingId = `${id}-heading-${index}`;
          const creatives = showAll ? group.creatives : group.creatives.slice(0,4);
          return <li key={group.key} className={styles.personaAccordionItem} data-open={open}>
            <button id={headingId} type="button" className={styles.personaAccordionToggle} aria-label={group.name} aria-expanded={open} aria-controls={panelId}
              onClick={() => { setExpanded(open ? '' : group.key); setShowAll(false); }}>
              <span className={styles.personaAccordionName}>{group.name}</span>
              <Status value={group.row?.status || 'Untested'} />
              <span className={styles.personaCreativeCount} aria-label={`${stats.creatives} creatives`}><Palette size={12} aria-hidden="true" />{stats.creatives}</span>
              <ChevronDown size={12} aria-hidden="true" className={styles.personaChevron} />
            </button>
            <section id={panelId} aria-labelledby={headingId} hidden={!open} className={styles.personaAccordionBody}>
              {open && <>
                <dl className={styles.personaMetrics}>
                  <div><dt>Creatives</dt><dd>{stats.creatives}</dd></div>
                  <div><dt>Winners</dt><dd>{stats.winners}</dd></div>
                  <div><dt>Win Rate</dt><dd>{stats.winRate}%</dd></div>
                </dl>
                {group.row?.archivedAt && <p>Archived</p>}{!group.row && <p>Not in catalog</p>}
                {group.row?.notes && <div className={styles.personaDetail}><span>Notes</span><p>{group.row.notes}</p></div>}
                {source && <div className={styles.personaDetail}><span>Source</span><a href={source} target="_blank" rel="noopener noreferrer">Source <ExternalLink size={12} /></a></div>}
                <h3>Creatives</h3>
                <ul className={styles.personaCreatives} aria-label="Related creatives">
                  {creatives.map((ad) => {
                    const link = safeCreativeUrl(ad.adLink);
                    return <li key={ad.id}>
                      <Status value={ad.status} />
                      <span className={styles.personaCreativeName} title={ad.formatName || ad.id}>{ad.formatName || ad.id}</span>
                      <span className={styles.personaCreativeActions}>
                      <button type="button" className={styles.personaTrackerLink} title={`Open ${ad.id} in Creative Tracker`} aria-label={`Open ${ad.id} in Creative Tracker`}
                        disabled={Boolean(error) || !isCreativeTrackerVisible(ad)} onClick={() => {
                          if (!error && relation.creatives.some((current) => current.id === ad.id && taxonomyKey(current[kind]) === taxonomyKey(row.name))) openCreative(ad.id);
                        }}><ClipboardList size={12} aria-hidden="true" />Tracker</button>
                      {link ? <a className={styles.personaInspirationLink} href={link} target="_blank" rel="noopener noreferrer" title={`Open inspiration for ${ad.formatName || ad.id}`} aria-label={`Open inspiration for ${ad.formatName || ad.id}`}><ArrowUpRight size={13} aria-hidden="true" /></a>
                        : <span className={styles.personaInspirationLink} role="link" aria-disabled="true" tabIndex={0} title="No valid inspiration link saved" aria-label={`No valid inspiration link saved for ${ad.formatName || ad.id}`}><ArrowUpRight size={13} aria-hidden="true" /></span>}
                      </span>
                    </li>;
                  })}
                </ul>
                {group.creatives.length > 4 && <button type="button" className={styles.personaShowAll} onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer' : `View all ${group.creatives.length} creatives`}</button>}
              </>}
            </section>
          </li>;
        })}
      </ul>
      {!relation.groups.length && <p className={styles.personaEmpty}>No {opposite}s tested with this {kind} yet.</p>}
    </>}
  </TrackerDialog>;
}
