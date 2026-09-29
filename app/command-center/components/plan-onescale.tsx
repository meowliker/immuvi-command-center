'use client';
import { useEffect, useRef, useState } from 'react';
import { Rocket, ShieldCheck } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActionRecord } from '../types';
import { ONESCALE_QA_BLOCKED, oneScaleTargets, readyToLaunch } from '../../../lib/domain/action-plan-onescale.js';
import { requestQaClickUp } from '../services/qa-clickup';
import { TrackerDialog } from './tracker-dialog';
import styles from '../../command-center.module.css';

export function PlanOneScale({ db, productId, selected, busy }: { db: SupabaseClient; productId: string; selected: ActionRecord[]; busy: boolean }) {
  const [snapshot, setSnapshot] = useState<ActionRecord[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [checkedAt, setCheckedAt] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const ready = selected.filter((action) => readyToLaunch(action.display.status));
  async function verify() {
    if (!snapshot || checking) return;
    setChecking(true); setError(''); setCheckedAt('');
    const abort = new AbortController(); controller.current = abort;
    try {
      const targets = oneScaleTargets(productId, snapshot);
      const result = await requestQaClickUp(db, productId, { operation: 'review-onescale', targets }, abort.signal);
      if (result.productId !== productId || result.externalLaunchEnabled !== false || !Array.isArray(result.tasks)
        || result.tasks.length !== targets.length || result.tasks.some((task: { adId: string; taskId: string }, i: number) => task.adId !== targets[i].adId || task.taskId !== targets[i].taskId)
        || !Number.isFinite(Date.parse(result.checkedAt))) throw new Error('Launch review response could not be verified.');
      if (!abort.signal.aborted) setCheckedAt(result.checkedAt);
    } catch (cause) { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not review selected tasks.'); }
    finally { if (!abort.signal.aborted) setChecking(false); }
  }
  return <>
    <button type="button" disabled={busy || !ready.length} title={ready.length ? `Review ${ready.length} selected ready-to-launch task(s)` : 'Select a visible Ready to Launch task'}
      onClick={() => { setSnapshot(ready); setError(''); setCheckedAt(''); }}><Rocket size={15} />Review OneScale launch</button>
    {snapshot ? <TrackerDialog title="OneScale launch review" closeLabel="Close OneScale review" busy={checking} error={error} onClose={() => setSnapshot(null)}>
      <div className={`${styles.trackerForm} ${styles.planDeleteForm}`}>
        <p role="status">{ONESCALE_QA_BLOCKED}</p>
        <ul>{snapshot.map((action) => <li key={action.display.dbId}><strong>{action.display.title}</strong> <span>{action.display.clickupTaskId || 'No ClickUp task'}</span></li>)}</ul>
        {checkedAt ? <p role="status">QA and ClickUp readiness verified at {new Date(checkedAt).toLocaleTimeString()}. No ads launched; no records changed.</p> : null}
        <footer><button type="button" disabled={checking || busy} onClick={() => void verify()}><ShieldCheck size={16} />{checking ? 'Verifying...' : 'Verify selected tasks'}</button>
          <button type="button" disabled title={ONESCALE_QA_BLOCKED}><Rocket size={16} />Launch in OneScale</button></footer>
      </div>
    </TrackerDialog> : null}
  </>;
}
