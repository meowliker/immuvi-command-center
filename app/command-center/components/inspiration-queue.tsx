import { productClickUpListId } from '../../../lib/domain/product-config.js';
import { isClaimStale } from '../../../lib/domain/worker-queue.js';
import { inspirationLink } from '../../../lib/domain/inspiration-library.js';
import styles from '../../command-center.module.css';
import inspirationStyles from '../inspiration.module.css';
import { formatAge, formatDateTime } from '../helpers/format';
import { queueStatusClass, workerHealthClass } from '../helpers/status-styles';
import { useInspiration } from '../hooks/use-inspiration';
import type { Product, QueueFilter } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ArrowUpRight } from 'lucide-react';
import { WorkerControls } from './worker-controls';
import { PrivateWorkerControls } from './private-worker-controls';

export function InspirationQueue({ supabase, activeProductId, activeProduct, inspect, inspectableIds=[],workerAdminId }: { supabase: SupabaseClient; activeProductId: string; activeProduct?: Product; inspect?:(id:string)=>void; inspectableIds?:string[];workerAdminId?:string }) {
  const {
    summary,
    busy,
    reload,
    error,
    loadedAt,
    filter,
    setFilter,
    filteredJobs,
    healthyWorkers,
    workers,
  } = useInspiration({ supabase, activeProductId, activeProduct });

  return (
    <>
      <section className={styles.adminToolbar}>
        <div><strong>{summary.pending}</strong><span>Pending</span></div>
        <div><strong>{summary.active}</strong><span>Active</span></div>
        <div className={summary.failed ? styles.healthBad : styles.healthOk}><strong>{summary.failed}</strong><span>Failed</span></div>
        <div><strong>{summary.blocked}</strong><span>Blocked</span></div>
        <button disabled={busy} type="button" onClick={reload}>{busy ? 'Refreshing...' : 'Refresh'}</button>
      </section>
      {error ? <div role="alert" className={styles.error}>{error}</div> : null}
      <PrivateWorkerControls db={supabase}/>
      <section className={styles.productBar}>
        <div className={styles.queueMeta}>
          <span>{activeProduct ? productClickUpListId(activeProduct) || 'No ClickUp list' : 'No product'}</span>
          <span>Loaded {formatDateTime(loadedAt)}</span>
        </div>
        <select aria-label="Queue status" className={styles.filterSelect} value={filter} onChange={(event) => setFilter(event.target.value as QueueFilter)}>
          <option value="all">All rows</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="classified">Classified</option>
          <option value="failed">Failed</option>
          <option value="blocked">Blocked</option>
        </select>
      </section>
      <section className={styles.queueGrid}>
        <section className={styles.queueMain}>
          <div className={styles.adminSectionHeader}><div><span className={styles.eyebrow}>Inspiration Queue</span><h2>Recent queue rows</h2></div></div>
          <div className={styles.queueRows}>
            {filteredJobs.length ? filteredJobs.map((job) => (
              <article className={styles.queueRow} key={job.id}>
                <div className={styles.jobTitle}><strong>{job.insId || job.id}</strong>{inspirationLink(job.url) ? <a href={inspirationLink(job.url)} target="_blank" rel="noopener noreferrer">{job.platform || 'source'}</a> : null}</div>
                <div className={styles.statusStack}>
                  <span className={queueStatusClass(job.status, styles)}>{job.status}</span>
                  {isClaimStale(job) ? <span className={styles.inactiveBadge}>Stale claim</span> : null}
                  {job.workerAssignment !== 'auto' ? <span className={styles.pendingBadge}>{job.workerAssignment}</span> : null}
                </div>
                <dl className={styles.queueFacts}>
                  <div><dt>Queued</dt><dd>{formatDateTime(job.queuedAt)}</dd></div>
                  <div><dt>Claimed</dt><dd>{job.claimedBy || '-'}</dd></div>
                  <div><dt>Attempts</dt><dd>{job.attempts}</dd></div>
                  <div><dt>Processed</dt><dd>{formatDateTime(job.processedAt) || '-'}</dd></div>
                </dl>
                {job.errorMessage ? <p className={styles.queueError}>{job.errorMessage}</p> : null}
                {inspect && inspectableIds.includes(job.insId)?<div className={inspirationStyles.commands}><button type="button" aria-label={`Inspect inspiration ${job.insId}`} onClick={()=>inspect(job.insId)}><ArrowUpRight size={14}/>Inspect</button></div>:null}
              </article>
            )) : <div className={styles.emptyState}>{!loadedAt ? error ? 'Queue unavailable.' : 'Loading queue...' : 'No queue rows match this filter.'}</div>}
          </div>
        </section>
        {workerAdminId ? <WorkerControls key={workerAdminId} db={supabase} userId={workerAdminId}/> : <aside className={styles.workerPanel}>
          <div><span className={styles.eyebrow}>Workers</span><h2>{healthyWorkers}/{workers.length} healthy</h2></div>
          <div className={styles.workerRows}>
            {workers.length ? workers.map((worker) => (
              <article className={styles.workerRow} key={worker.workerId}>
                <div><strong>{worker.workerId}</strong><span>{worker.hostname || worker.os || 'unknown host'}</span></div>
                <span className={workerHealthClass(worker.health, styles)}>{worker.health}</span>
                <dl>
                  <div><dt>Heartbeat</dt><dd>{formatAge(worker.heartbeatAgeMs)}</dd></div>
                  <div><dt>Last Job</dt><dd>{formatDateTime(worker.lastJobAt) || '-'}</dd></div>
                  <div><dt>Done / Failed</dt><dd>{worker.jobsCompletedTotal} / {worker.jobsFailedTotal}</dd></div>
                  <div><dt>Contract</dt><dd>{capabilityText(worker.capabilities, 'worker_contract') || '-'}</dd></div>
                </dl>
              </article>
            )) : <div className={styles.emptyState}>No workers registered in QA yet.</div>}
          </div>
        </aside>}
      </section>
    </>
  );
}

function capabilityText(capabilities: Record<string, unknown>, key: string) {
  const value = capabilities[key];
  if (value === undefined || value === null || value === '') return '';
  return String(value);
}
