'use client';
import { useEffect, useMemo, useState } from 'react';
import { createPlanEditQueue, projectPlanEdits } from '../../../lib/services/plan-edit-queue.js';
import type { ActionRecord } from '../types';

export type PlanEdit = { kind: 'creative' | 'fields'; values: Record<string, unknown> } | { kind: 'status' | 'due'; value: string; changedAt?: number };
type Pending = { id: number; key: string; edit: PlanEdit };
type Schedule = (operation: () => Promise<void>) => () => Promise<void>;

export function usePlanEditQueue(productId: string, rows: ActionRecord[], failed: (message: string) => void, completed: (message: string) => void) {
  const [state, setState] = useState<{ queue: unknown; pending: Pending[] } | null>(null);
  const queue = useMemo(() => createPlanEditQueue({
    changed: (pending: Pending[]) => setState({ queue, pending }), failed, completed,
  }), [productId, failed, completed]);
  useEffect(() => { queue.start(); return () => queue.dispose(); }, [queue]);
  const pending = state?.queue === queue ? state.pending : [];
  return {
    actions: projectPlanEdits(rows, pending) as ActionRecord[], pending: pending.length,
    run: (action: ActionRecord, edit: PlanEdit, execute: (baseline: ActionRecord, remember: (saved: ActionRecord) => void) => Promise<void>, schedule: Schedule) =>
      queue.run(rows.find(row => row.display.dbId === action.display.dbId && row.actionVersion === action.actionVersion && row.adVersion === action.adVersion) || action, edit, execute, schedule),
  };
}
