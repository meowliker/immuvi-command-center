'use client';
import { useEffect, useState } from 'react';
import { LockKeyhole, Pause, Play } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import styles from '../private-workers.module.css';

type Worker = { id: string; name: string; enabled: boolean; generation_available: boolean; heartbeat_at: string | null; codex_active?:boolean; claude_active?:boolean };
const imageWorkerOnline = (worker:Worker) => worker.enabled && Date.now()-Date.parse(worker.heartbeat_at||'')<45000;
export function PrivateWorkerControls({ db }: { db: SupabaseClient }) {
  const [workers, setWorkers] = useState<Worker[]>([]), [error, setError] = useState(''), [saving, setSaving] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await db.rpc('qa_private_workers_list');
        if (result.error || !Array.isArray(result.data)) throw new Error('Invalid worker response');
        if (!cancelled) { setWorkers(result.data); setError(''); }
      } catch { if (!cancelled) setError('Private worker status is unavailable.'); }
    }
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [db, revision]);
  async function toggle(worker: Worker) {
    setSaving(worker.id); setError('');
    try {
      const result = await db.rpc('qa_private_worker_set_enabled', { p_id: worker.id, p_enabled: !worker.enabled });
      if (result.error) throw result.error;
      setRevision(value => value + 1);
    } catch { setError('Could not change your private worker.'); }
    finally { setSaving(''); }
  }
  if (!workers.length && !error) return null;
  return <section className={styles.panel} aria-label="My private workers">
    <div className={styles.heading}><h2>My worker</h2><LockKeyhole size={14}/></div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div>{workers.map(worker => <article className={styles.row} key={worker.id}>
      <div><div className={styles.identity}><strong>{worker.name}</strong><span className={styles.state} data-online={imageWorkerOnline(worker)}>{!worker.enabled ? 'Paused' : imageWorkerOnline(worker) ? 'Online' : 'Offline'}</span></div>
      <div className={styles.capabilities}><span data-active={imageWorkerOnline(worker) && !!worker.codex_active}>Codex: {imageWorkerOnline(worker) && worker.codex_active?'Active':'Inactive'}</span><span data-active={imageWorkerOnline(worker) && !!worker.claude_active}>Claude: {imageWorkerOnline(worker) && worker.claude_active?'Active':'Inactive'}</span></div></div>
      <button type="button" disabled={!!saving} title={worker.enabled ? 'Pause new jobs; current work finishes' : 'Resume private worker'} onClick={() => void toggle(worker)}>
        {worker.enabled ? <Pause size={14}/> : <Play size={14}/>}{worker.enabled ? 'Pause' : 'Resume'}
      </button>
    </article>)}</div>
  </section>;
}
