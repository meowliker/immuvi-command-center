'use client';
import { useState } from 'react';
import { Pause, Play, RefreshCw } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useWorkerControls, type ControlledWorker } from '../hooks/use-worker-controls';
import { formatAge, formatDateTime } from '../helpers/format';
import { workerHealthClass } from '../helpers/status-styles';
import { TrackerDialog } from './tracker-dialog';
import styles from '../../command-center.module.css';

export function WorkerControls({ db, userId }: { db: SupabaseClient; userId: string }) {
  const state = useWorkerControls(db, userId);
  const [selected, setSelected] = useState<ControlledWorker | null>(null);
  const blocked = !state.ready || state.saving || !!state.pending;
  return <section className={styles.workerAdministration} aria-label="Worker pool">
    <div className={styles.adminSectionHeader}><h2>Worker pool</h2><button type="button" title="Refresh worker pool" aria-label="Refresh worker pool" disabled={state.refreshing || state.saving} onClick={() => state.reload()}><RefreshCw size={16}/></button></div>
    <p className={styles.muted}>Legacy shared workers are disabled in QA.</p>
    {state.error && !selected && <p role="alert" className={styles.error}>{state.error}</p>}
    {state.notice && <p role="status" className={styles.notice}>{state.notice}</p>}
    {state.pending && <div className={styles.notice}>Pending pause: {state.pending.p_worker_id}. <button type="button" disabled={state.saving} onClick={() => state.submit(state.pending!)}>Recover worker pause</button></div>}
    <div className={styles.workerRows}>{state.workers.map((worker) => <article className={styles.workerRow} key={worker.workerId} aria-label={`Worker ${worker.workerId}`}>
      <div><strong>{worker.workerId}</strong><span>{worker.hostname || 'Unknown host'} / {worker.os || '-'}</span></div>
      <span className={workerHealthClass(worker.health, styles)}>{worker.health}</span>
      <dl><div><dt>Heartbeat</dt><dd>{formatAge(worker.heartbeatAgeMs)}</dd></div><div><dt>Reported status</dt><dd>{worker.status}</dd></div>
        <div><dt>Current job</dt><dd>{worker.currentJobId || '-'}</dd></div><div><dt>Last job</dt><dd>{formatDateTime(worker.lastJobAt) || '-'}</dd></div>
        <div><dt>Done / failed</dt><dd>{worker.jobsCompletedTotal} / {worker.jobsFailedTotal}</dd></div>
        <div><dt>Contract</dt><dd>{typeof worker.capabilities.worker_contract === 'string' ? worker.capabilities.worker_contract : 'Unverified'}</dd></div>
        <div><dt>Capabilities</dt><dd>{['ffmpeg', 'claude', 'codex', 'yt_dlp'].filter((name) => worker.capabilities[name] === true).join(', ') || 'None reported'}</dd></div></dl>
      <div className={styles.rowActions}>{worker.enabled ? <button type="button" title={`Pause ${worker.workerId}`} aria-label={`Pause ${worker.workerId}`} disabled={blocked || !!state.readError} onClick={() => setSelected(worker)}><Pause size={16}/>Pause</button>
        : <button type="button" disabled title="Resume blocked: no isolated QA worker destination"><Play size={16}/>Resume</button>}</div>
    </article>)}</div>
    {!state.workers.length && <p className={styles.emptyState}>{!state.loaded ? state.error ? 'Worker pool unavailable.' : 'Loading workers...' : 'No workers registered in QA yet.'}</p>}
    {selected && <TrackerDialog title="Pause worker" closeLabel="Close worker pause" busy={state.saving} error={state.error} onClose={() => setSelected(null)}>
      <p>{selected.workerId}</p><p>This requests a pause before new work is claimed. Running jobs are not cancelled; the worker must observe the request.</p>
      <footer><button type="button" disabled={state.saving} onClick={() => setSelected(null)}>Cancel</button><button type="button" disabled={blocked} onClick={async () => { if (await state.submit({ p_request_id: crypto.randomUUID(), p_worker_id: selected.workerId, p_revision: selected.revision })) setSelected(null); }}><Pause size={16}/>Confirm pause</button></footer>
    </TrackerDialog>}
  </section>;
}
