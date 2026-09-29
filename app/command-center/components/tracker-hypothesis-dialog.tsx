import type { Creative } from '../types';
import { TrackerDialog } from './tracker-dialog';
import styles from '../../command-center.module.css';

export function TrackerHypothesisDialog({ creative, onClose }: { creative?: Creative; onClose: () => void }) {
  return <TrackerDialog title="Creative hypothesis" busy={false} onClose={onClose} closeLabel="Close hypothesis" className={styles.trackerHypothesisDialog}>
    {creative ? <div className={styles.trackerHypothesisBody} tabIndex={0} role="region" aria-label="Creative details and full hypothesis">
      <h3>{creative.formatName || creative.id}</h3>
      <dl className={styles.trackerHypothesisDetails}>
        <div><dt>Status</dt><dd>{creative.status || '-'}</dd></div>
        <div><dt>Type / Funnel</dt><dd>{[creative.adType, creative.funnelStage].filter(Boolean).join(' / ') || '-'}</dd></div>
        <div><dt>Angle</dt><dd>{creative.angle || '-'}</dd></div>
        <div><dt>Persona</dt><dd>{creative.persona || '-'}</dd></div>
      </dl>
      <h4>Hypothesis</h4>
      <p className={styles.trackerHypothesisText}>{creative.creativeHypothesis || 'No hypothesis added.'}</p>
    </div> : <p role="status">This creative is no longer available.</p>}
  </TrackerDialog>;
}
