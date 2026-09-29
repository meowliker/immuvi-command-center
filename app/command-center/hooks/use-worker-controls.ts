'use client';
import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readWorkers, pauseWorker, validateWorkerPause } from '../../../lib/services/worker-controls.js';
import { getLiveSync } from '../../../lib/services/live-sync.js';
import { useLiveQuery } from './use-live-query';
import { normalizeWorker } from '../../../lib/domain/worker-queue.js';

type PauseRequest = { p_request_id: string; p_worker_id: string; p_revision: string };
export type ControlledWorker = ReturnType<typeof normalizeWorker> & { revision: string };
export function useWorkerControls(db: SupabaseClient, userId: string) {
  const key = `immuvi:qa:worker-pause:${userId}`;
  const [rows, setRows] = useState<Record<string, any>[]>([]), [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState<PauseRequest | null>(null), [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now());
  const mounted = useRef(false), lock = useRef(false);
  useEffect(() => {
    mounted.current = true;
    try { const raw = sessionStorage.getItem(key); if (raw) setPending(validateWorkerPause(JSON.parse(raw))); setReady(true); }
    catch { setError('Worker recovery data is unavailable. New pause requests are blocked.'); }
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => { mounted.current = false; clearInterval(timer); };
  }, [key]);
  const query = useLiveQuery({ supabase: db, productId: '', scopeKey: `worker-controls:${userId}`, tables: ['worker_registry'],
    load: async (signal) => { const result = await readWorkers(db, signal); return () => { setRows(result); setLoaded(true); }; },
  });
  async function submit(request: PauseRequest) {
    if (!ready || lock.current) return false;
    if (pending && JSON.stringify(pending) !== JSON.stringify(request)) { setError('Recover the pending worker pause first.'); return false; }
    const finish = getLiveSync(db).beginWrite('');
    if (!finish) { setError('Another change is still being saved.'); return false; }
    lock.current = true; setSaving(true); setError(''); setNotice(''); let sent = false;
    try {
      validateWorkerPause(request);
      const { data, error: authError } = await db.auth.getSession();
      if (authError || data.session?.user.id !== userId) throw Object.assign(new Error('Sign in with the original administrator account.'), { definite: true });
      sessionStorage.setItem(key, JSON.stringify(request)); setPending(request); sent = true;
      await pauseWorker(db, request);
      sessionStorage.removeItem(key);
      if (mounted.current) { setPending(null); setNotice(`Pause request saved for ${request.p_worker_id}. In-flight work is not cancelled.`); }
      return true;
    } catch (cause) {
      if ((!sent && !pending) || (cause as { definite?: boolean }).definite) {
        try { sessionStorage.removeItem(key); if (mounted.current) setPending(null); }
        catch { if (mounted.current) setReady(false); }
      }
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Worker pause failed.');
      return false;
    } finally { lock.current = false; if (mounted.current) setSaving(false); finish(); }
  }
  return { workers: rows.map((row) => ({ ...normalizeWorker(row, now), revision: row.control_revision })) as ControlledWorker[],
    loaded, pending, saving, ready, error: error || query.error, readError: query.error, notice, refreshing: query.busy,
    reload: () => { setError(''); return query.refresh(); }, submit };
}
