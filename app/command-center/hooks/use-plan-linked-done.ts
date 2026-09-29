'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActionRecord } from '../types';
import { planLinkedCandidates, planLinkedCacheKey, PLAN_LINKED_DONE_TTL } from '../../../lib/domain/action-plan-linked-done.js';
import { requestQaClickUp } from '../services/qa-clickup';

type Entry = { doneAt: number | null; error: string; checkedAt: number };
type Candidate = { adId: string; taskId: string; version: string };
export function usePlanLinkedDone(db: SupabaseClient, productId: string, listId: string, actions: ActionRecord[], now: number) {
  const signature = JSON.stringify(planLinkedCandidates(actions));
  const candidates = useMemo<Candidate[]>(() => JSON.parse(signature), [signature]);
  const scope = JSON.stringify([productId, listId]);
  const cache = useRef(new Map<string, Entry>());
  const [revision, setRevision] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const activeKeys = new Set(candidates.map((item) => planLinkedCacheKey(scope, item)));
    for (const key of cache.current.keys()) if (!activeKeys.has(key)) cache.current.delete(key);
    const pending = candidates.filter((item) => {
      const entry = cache.current.get(planLinkedCacheKey(scope, item));
      return !entry || now - entry.checkedAt >= PLAN_LINKED_DONE_TTL;
    });
    setLoading(Boolean(listId && pending.length));
    if (!listId || !pending.length) return;
    void (async () => {
      for (let offset = 0; offset < pending.length; offset += 20) {
        const batch = pending.slice(offset, offset + 20);
        try {
          const response = await requestQaClickUp(db, productId, { operation: 'plan-linked-done', adIds: batch.map((item) => item.adId) }, controller.signal);
          if (controller.signal.aborted) return;
          if (!Array.isArray(response.rows)) throw new Error('Completion-date response is incomplete.');
          for (const item of batch) {
            const row = response.rows.find((entry: Candidate) => entry.adId === item.adId);
            const matching = row?.taskId === item.taskId && row?.version === item.version;
            const validDate = row?.doneAt === null || (typeof row?.doneAt === 'number' && row.doneAt > 0 && Number.isFinite(new Date(row.doneAt).getTime()));
            cache.current.set(planLinkedCacheKey(scope, item), {
              doneAt: matching && validDate && !row.error ? row.doneAt : null,
              error: row?.error || (!matching ? 'Task changed. Refresh completion dates.' : !validDate ? 'Completion date is invalid.' : ''),
              checkedAt: now,
            });
          }
          setRevision((value) => value + 1);
          if (response.throttled) {
            for (const item of pending.slice(offset + 20)) cache.current.set(planLinkedCacheKey(scope, item), { doneAt: null, error: 'ClickUp rate limit reached. Retry later.', checkedAt: now });
            break;
          }
        } catch (cause) {
          if (controller.signal.aborted) return;
          for (const item of pending.slice(offset)) cache.current.set(planLinkedCacheKey(scope, item), {
            doneAt: null, error: cause instanceof Error ? cause.message : 'Completion dates unavailable.', checkedAt: now,
          });
          setRevision((value) => value + 1); break;
        }
      }
    })().finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [db, productId, listId, scope, candidates, now, attempt]);
  const resolved = useMemo(() => {
    const dates = new Map<string, number>();
    let error = '';
    for (const item of candidates) {
      const entry = cache.current.get(planLinkedCacheKey(scope, item));
      if (!entry || now - entry.checkedAt >= PLAN_LINKED_DONE_TTL) continue;
      if (entry.error) error ||= entry.error;
      else if (entry.doneAt !== null) dates.set(item.adId, entry.doneAt);
    }
    return { dates, error };
  }, [scope, candidates, now, revision]);
  return { ...resolved, loading, count: candidates.length, reload: () => { cache.current.clear(); setRevision((value) => value + 1); setAttempt((value) => value + 1); } };
}
