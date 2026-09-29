'use client';
import { useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActionRecord } from '../types';
import type { useActionPlan } from './use-action-plan';
import type { PlanAges } from '../components/plan-age-badge';
import { checkpointReview } from '../../../lib/domain/action-plan-checkpoint.js';
import { savePlanCheckpoint } from '../../../lib/services/action-plan-checkpoint.js';
import { requestQaClickUp } from '../services/qa-clickup';
import { creationLocked } from '../services/plan-workflow';

export function usePlanCheckpoint(db: SupabaseClient, productId: string, plan: ReturnType<typeof useActionPlan>, ages: PlanAges) {
  const [target, setTarget] = useState<{ action: ActionRecord; phase: string; canSnooze: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const ads = useMemo(() => new Map(plan.ageAds.map((ad) => [ad.id, ad])), [plan.ageAds]);
  function available(action: ActionRecord) {
    return checkpointReview(action, ages.get(action.display.dbId), ads.get(action.display.linkedAdId)).available
      && !creationLocked(plan.creationJobs.find((job) => job.ad_id === action.display.linkedAdId));
  }
  function open(action: ActionRecord) {
    if (!available(action)) return;
    const age = ages.get(action.display.dbId)!;
    setError(''); setNotice('');
    setTarget({ action, phase: age.phase, canSnooze: checkpointReview(action, age, ads.get(action.display.linkedAdId)).canSnooze });
  }
  async function save(decision: string, push: boolean) {
    if (!target || busy) return;
    await plan.mutate(async () => {
      setBusy(true); setError('');
      try {
        const action = await plan.promote(target.action);
        const result = await savePlanCheckpoint(db, productId, action, decision,
          push ? (input: Record<string, unknown>) => requestQaClickUp(db, productId, input) : null);
        setNotice(result.message); setTarget(null);
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save testing review.'); }
      finally { setBusy(false); }
    })();
  }
  return { target, busy, error, notice, available, open, save, close: () => { if (!busy) setTarget(null); } };
}

export type PlanCheckpointControl = Pick<ReturnType<typeof usePlanCheckpoint>, 'available' | 'open'>;
