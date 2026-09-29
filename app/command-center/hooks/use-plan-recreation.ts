'use client';
import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActionRecord } from '../types';
import type { useActionPlan } from './use-action-plan';
import { planRecreationTarget } from '../../../lib/domain/action-plan-recreation.js';
import { creationLocked } from '../services/plan-workflow';
import { requestQaClickUp } from '../services/qa-clickup';

export function usePlanRecreation(db: SupabaseClient, productId: string, plan: Pick<ReturnType<typeof useActionPlan>, 'mutate' | 'creationJobs'>) {
  const [target, setTarget] = useState<ReturnType<typeof planRecreationTarget> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  function available(action: ActionRecord) {
    try { planRecreationTarget(productId, action); return !creationLocked(plan.creationJobs.find((job) => job.ad_id === action.display.linkedAdId)); }
    catch { return false; }
  }
  function open(action: ActionRecord) {
    if (!available(action)) return;
    setTarget(planRecreationTarget(productId, action)); setError(''); setNotice('');
  }
  async function save() {
    if (!target || busy) return;
    await plan.mutate(async () => {
      setBusy(true); setError('');
      try {
        const result = await requestQaClickUp(db, productId, { operation: 'repair-plan-task', adId: target.adId,
          oldTaskId: target.taskId, adVersion: target.version, actionId: target.actionId, actionVersion: target.actionVersion });
        if (result.state !== 'linked' || !/^[a-zA-Z0-9_-]+$/.test(result.taskId || '') || !['relinked', 'recreated'].includes(result.mode)) throw new Error('Repair result could not be verified. Refresh before retrying.');
        setNotice(result.mode === 'relinked' ? `Verified and restored ClickUp link ${result.taskId}. No replacement was created.` : `Replacement ClickUp task ${result.taskId} is verified and linked.`);
        setTarget(null);
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not repair the ClickUp link.'); }
      finally { setBusy(false); }
    })();
  }
  return { target, busy, error, notice, available, open, save, close: () => { if (!busy) setTarget(null); } };
}
