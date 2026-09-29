'use client';
import { useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readPlanHistoryPage } from '../../../lib/services/action-plan-history.js';
import { useLiveQuery } from './use-live-query';

export type PlanHistoryTarget = { actionId: string; taskId: string; adId: string } | null;
export function usePlanHistory(db: SupabaseClient, productId: string, target: PlanHistoryTarget) {
  const desiredPages = useRef(1);
  const [snapshot, setSnapshot] = useState({ rows: [] as Awaited<ReturnType<typeof readPlanHistoryPage>>['rows'], pages: 0, hasMore: false });
  const live = useLiveQuery({ supabase: db, productId, tables: ['activity_events'], load });
  async function load(signal: AbortSignal) {
    const rows: typeof snapshot.rows = [], seen = new Set();
    let cursor: Awaited<ReturnType<typeof readPlanHistoryPage>>['cursor'] = null;
    let hasMore = true, pages = 0;
    // Refresh the loaded window atomically so new events cannot shift offset pages.
    while (pages < desiredPages.current && hasMore) {
      const page = await readPlanHistoryPage(db, productId, target, cursor, signal);
      for (const row of page.rows) {
        if (seen.has(row.id)) throw new Error('History pagination repeated an event. Refresh to retry.');
        seen.add(row.id); rows.push(row);
      }
      cursor = page.cursor; hasMore = page.hasMore; pages++;
    }
    return () => setSnapshot({ rows, pages, hasMore });
  }
  return { ...snapshot, busy: live.busy, error: live.error, refresh: () => live.refresh(),
    loadMore: () => { desiredPages.current = snapshot.pages + 1; return live.refresh(); } };
}
