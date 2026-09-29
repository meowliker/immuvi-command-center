import { useMemo } from 'react';
import { RotateCcw, ChevronDown } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { usePlanHistory, type PlanHistoryTarget } from '../hooks/use-plan-history';
import { planHistoryTimeline } from '../../../lib/domain/action-plan-history.js';
import { formatDateTime } from '../helpers/format';
import styles from '../../command-center.module.css';

export function PlanHistory({ db, productId, target = null, payload = {} }: { db: SupabaseClient; productId: string; target?: PlanHistoryTarget; payload?: Record<string, unknown> }) {
  const history = usePlanHistory(db, productId, target);
  const timeline = useMemo(() => planHistoryTimeline(history.rows, payload), [history.rows, payload]);
  return <section className={styles.planHistory} aria-label={target ? 'Task history' : 'Product history'}>
    <div className={styles.adminSectionHeader}><h3>{target ? 'History' : 'Recent events'}</h3><button type="button" aria-label="Refresh history" title="Refresh history" disabled={history.busy} onClick={() => void history.refresh()}><RotateCcw size={16} /></button></div>
    {history.busy ? <p role="status">Loading history...</p> : null}
    {history.error ? <p role="alert" className={styles.error}>{history.error}</p> : null}
    <div className={`${styles.eventRows} ${styles.planHistoryRows}`} tabIndex={0} aria-label="History events">{timeline.map((event) => <article className={styles.eventRow} key={event.id} data-history-id={event.id}>
      <strong>{event.title}</strong>{event.detail ? <span>{event.detail}</span> : null}
      <small>{[event.actor, event.source].filter(Boolean).join(' via ')}</small>
      <small>{event.ts === null ? 'Date unavailable' : formatDateTime(new Date(event.ts).toISOString())}</small>
    </article>)}</div>
    {!timeline.length && !history.busy && !history.error ? <p className={styles.emptyState}>No recorded history.</p> : null}
    {history.pages > 0 ? <small>{history.rows.length} recorded events loaded{history.hasMore ? '' : ' - all available events loaded'}</small> : null}
    {history.hasMore || (history.error && !history.pages) ? <button type="button" disabled={history.busy} onClick={() => void history.loadMore()}><ChevronDown size={16} />{history.error ? 'Retry history' : 'Load older events'}</button> : null}
  </section>;
}
