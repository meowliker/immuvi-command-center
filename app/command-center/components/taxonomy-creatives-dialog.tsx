'use client';

import { ClipboardList, ExternalLink } from 'lucide-react';
import { safeCreativeUrl } from '../../../lib/domain/tracker-editing.js';
import { isCreativeTrackerVisible } from '../../../lib/domain/creative-tracker.js';
import { taxonomyKey } from '../../../lib/domain/taxonomy.js';
import type { taxonomyRelationships } from '../../../lib/domain/taxonomy-workspace.js';
import type { TaxonomyKind, TaxonomyRow } from '../types';
import { TrackerDialog } from './tracker-dialog';
import { TaxonomyPopupStatus } from './taxonomy-popup-status';
import styles from '../../command-center.module.css';

const statusOrder: Record<string, number> = { Winner: 0, 'Mild Winner': 1, Scale: 2, Testing: 3, 'In Progress': 4, Untested: 5, Loser: 6 };

export function TaxonomyCreativesDialog({ kind, row, relation, error, onClose, openCreative }: {
  kind: TaxonomyKind; row?: TaxonomyRow; relation?: ReturnType<typeof taxonomyRelationships>; error: string;
  onClose: () => void; openCreative: (id: string) => void;
}) {
  const opposite = kind === 'angle' ? 'persona' : 'angle';
  const creatives = [...(relation?.creatives || [])].sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));
  return <TrackerDialog title={row?.name || 'Unavailable'} className={styles.anglePersonasDialog} busy={false}
    error={error ? `${error} Showing the last successful snapshot.` : ''} onClose={onClose} closeLabel="Close relationships">
    {!row || !relation ? <p role="status">This taxonomy record is no longer available.</p> : <>
      <p className={styles.personaDialogSubtitle}>{creatives.length} {creatives.length === 1 ? 'creative' : 'creatives'}</p>
      <ul className={styles.taxonomyCreativeList} aria-label="Related creatives">
        {creatives.map((ad) => {
          const link = safeCreativeUrl(ad.adLink);
          return <li key={ad.id}>
            <span className={styles.taxonomyCreativeId} title={ad.id}>{ad.id}</span>
            <span className={styles.taxonomyCreativeName}>{ad.formatName || ad.id}</span>
            <div className={styles.taxonomyCreativeTags}>
              {ad[opposite] && <span>{ad[opposite]}</span>}{ad.hookType && <span>{ad.hookType}</span>}
            </div>
            <TaxonomyPopupStatus value={ad.status} />
            <span className={styles.personaCreativeActions}>
              <button type="button" className={styles.personaTrackerLink} title={`Open ${ad.id} in Creative Tracker`} aria-label={`Open ${ad.id} in Creative Tracker`}
                disabled={Boolean(error) || !isCreativeTrackerVisible(ad)} onClick={() => {
                  if (!error && relation.creatives.some((current) => current.id === ad.id && taxonomyKey(current[kind]) === taxonomyKey(row.name))) openCreative(ad.id);
                }}><ClipboardList size={12} aria-hidden="true" />Tracker</button>
              {link && <a href={link} target="_blank" rel="noopener noreferrer" title={`Open inspiration for ${ad.formatName || ad.id}`} aria-label={`Open inspiration for ${ad.formatName || ad.id}`}><ExternalLink size={12} aria-hidden="true" />Ad</a>}
            </span>
          </li>;
        })}
      </ul>
      {!creatives.length && <p className={styles.personaEmpty}>No creatives yet for this {kind}.</p>}
    </>}
  </TrackerDialog>;
}
