import type { Creative, MatrixCell } from '../types';
import styles from '../../command-center.module.css';

type Props = {
  creative: Creative;
  creatives: Creative[];
  cells: MatrixCell[];
  taxonomy: { angleNames: Record<string, string>; personaNames: Record<string, string> };
};

export function TrackerMatrixUsage({ creative, creatives, cells, taxonomy }: Props) {
  const pair = (angle: string, persona: string) => `${angle || 'Unassigned angle'} \u00d7 ${persona || 'Unassigned persona'}`;
  if (creative.taskType === 'production') {
    return <span className={styles.trackerMatrixPair}>{pair(creative.angle, creative.persona)}</span>;
  }
  // Legacy formats use their spawned production tasks, falling back to direct cell assignments.
  const production = creatives.filter((ad) => ad.sourceFormatId === creative.id && ad.taskType === 'production');
  const locations = production.length
    ? production.map((ad) => ({ id: ad.id, label: pair(ad.angle, ad.persona), name: ad.formatName }))
    : cells.filter((cell) => Array.isArray(cell.creative_assignments) && cell.creative_assignments.includes(creative.id))
      .map((cell) => ({ id: cell.id, label: pair(taxonomy.angleNames[cell.angle_id] || cell.angle_id, taxonomy.personaNames[cell.persona_id] || cell.persona_id), name: '' }));
  if (!locations.length) return <span className={styles.trackerMatrixEmpty}>Not in matrix</span>;
  return <div className={styles.trackerMatrixUsage}>
    <span className={styles.trackerMatrixCount}>{locations.length} {production.length ? `production task${locations.length === 1 ? '' : 's'}` : `cell${locations.length === 1 ? '' : 's'}`}</span>
    <ul aria-label={`Matrix usage for ${creative.formatName || creative.id}`}>
      {locations.map((location) => <li key={location.id}><span className={styles.trackerMatrixPair}>{location.label}</span>{location.name ? <small>{location.name}</small> : null}</li>)}
    </ul>
  </div>;
}
