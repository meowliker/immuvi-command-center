'use client';
import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActionRecord } from '../types';
import type { useActionPlan } from './use-action-plan';
import { planDeletionTarget } from '../../../lib/domain/action-plan-deletion.js';
import { deletePlanCreative } from '../../../lib/services/action-plan-deletion.js';
import { requestQaClickUp } from '../services/qa-clickup';
import { creationLocked } from '../services/plan-workflow';

export type PlanDeletionTarget = ReturnType<typeof planDeletionTarget>;
export function usePlanDeletion(db: SupabaseClient, productId: string, plan: Pick<ReturnType<typeof useActionPlan>, 'mutate' | 'creationJobs'>) {
  const [target, setTarget] = useState<PlanDeletionTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [remoteDeleted, setRemoteDeleted] = useState<string[]>([]);
  function available(action: ActionRecord) {
    try { planDeletionTarget(productId, action); return !creationLocked(plan.creationJobs.find((job) => job.ad_id === action.display.linkedAdId)); }
    catch { return false; }
  }
  function open(action: ActionRecord) {
    if (!available(action)) return;
    setTarget(planDeletionTarget(productId, action)); setError(''); setNotice('');
  }
  function openDeleted(value: PlanDeletionTarget) {
    if (value.productId !== productId || !value.deletedAt || !value.taskId) return;
    setTarget(value); setError(''); setNotice('');
  }
  async function save(deleteRemote: boolean) {
    if (!target || busy) return;
    await plan.mutate(async () => {
      setBusy(true); setError(''); setNotice('');
      let deleted = target;
      try {
        if (!deleted.deletedAt) { deleted = await deletePlanCreative(db, productId, target); setTarget(deleted); }
        if (deleteRemote && deleted.taskId) {
          const result = await requestQaClickUp(db, productId, { operation: 'delete-plan-task', adId: deleted.adId, taskId: deleted.taskId });
          if (!result.deleted || result.adId !== deleted.adId || result.taskId !== deleted.taskId) throw new Error('ClickUp deletion could not be verified.');
          setRemoteDeleted((ids) => [...new Set([...ids, deleted.adId])]);
        }
        setTarget(null);
        setNotice(deleteRemote && deleted.taskId ? 'Creative deleted in QA and its linked test-list ClickUp task deleted.' : 'Creative deleted in QA. ClickUp was not changed. Independent variations were preserved.');
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Deletion failed.';
        setError(deleted.deletedAt ? `Deleted in QA; ClickUp deletion is not confirmed. ${message}` : message);
      } finally { setBusy(false); }
    })();
  }
  return { target, busy, error, notice, remoteDeleted, available, open, openDeleted, save, close: () => { if (!busy) setTarget(null); } };
}
