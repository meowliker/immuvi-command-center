'use client';

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PRODUCTION_COLUMNS, productionBucket, productionDropStatus } from '../../../lib/domain/production.js';
import { readProductRows } from '../../../lib/services/product-rows.js';
import { buildActionRecords } from '../helpers/actions';
import { persistActionDueDate, persistActionStatus } from '../services/actions';
import type { ActionRecord, Product } from '../types';
import { usePlanStatuses } from './use-plan-statuses';
import { productClickUpListId } from '../../../lib/domain/product-config.js';
import { workflowStatuses } from '../helpers/creatives';
import { useLiveQuery, type RefreshOptions } from './use-live-query';
import { useReconciledState } from './use-reconciled-state';
import { creationLocked, type CreationJob } from '../services/plan-workflow';
import { deletedPlanTargets } from '../../../lib/domain/action-plan-deletion.js';

export function useProduction({ supabase, activeProductId, activeProduct }: { supabase: SupabaseClient; activeProductId: string; activeProduct?: Product }) {
  const statusRules = usePlanStatuses(supabase, activeProductId, productClickUpListId(activeProduct));
  const [actions, setActions] = useReconciledState<ActionRecord[]>([], (action) => action.display.dbId);
  const [loadedAt, setLoadedAt] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [draggedAction, setDraggedAction] = useState<ActionRecord | null>(null);
  const [dropTarget, setDropTarget] = useState('');
  const [dueAction, setDueAction] = useState<ActionRecord | null>(null);
  const [creationJobs,setCreationJobs] = useReconciledState<CreationJob[]>([]);
  const [deletedCreatives,setDeletedCreatives] = useReconciledState<ReturnType<typeof deletedPlanTargets>>([]);

  const { refresh, busy, error: syncError, mutate } = useLiveQuery({
    supabase, productId: activeProductId, tables: ['manual_actions', 'ads', 'deleted_ads', 'qa_clickup_creations'],
    enabled: Boolean(activeProductId), load,
    onMutationError: setError, onMutationEnd: () => setBusyAction(''),
  });

  async function load(signal: AbortSignal, options: RefreshOptions) {
    const [manualRows, adRows, tombstones, jobs] = await Promise.all([
      readProductRows(supabase, 'manual_actions', activeProductId, signal),
      readProductRows(supabase, 'ads', activeProductId, signal),
      readProductRows(supabase, 'deleted_ads', activeProductId, signal),
      readProductRows(supabase, 'qa_clickup_creations', activeProductId, signal),
    ]);
    const scoped = (rows: Record<string, any>[]) => rows.filter((row) => row.product_id === activeProductId);
    const next = buildActionRecords(scoped(manualRows).sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)), scoped(adRows), scoped(tombstones));
    return () => {
      setActions(next);
      setCreationJobs(jobs);
      setDeletedCreatives(deletedPlanTargets(activeProductId,adRows,tombstones));
      if (!options.background) setLoadedAt(new Date().toISOString());
    };
  }

  async function reload() { setError(''); setNotice(''); await refresh(); }

  async function saveWorkflow(action: ActionRecord, operation: 'status' | 'due', value: string) {
    if (locked(action)) throw new Error('Recover unresolved ClickUp creation before editing.');
    if (!actions.some((row) => row.display.dbId === action.display.dbId)) throw new Error('This production task is no longer available. Refresh before editing.');
    setBusyAction(`${operation}:${action.display.dbId}`); setError(''); setNotice('');
    const result = await (operation === 'status' ? persistActionStatus : persistActionDueDate)(supabase, activeProductId, action, value);
    setActions((current) => current.map((item) => item.display.dbId === action.display.dbId ? {
      ...item, payload: result.payload, linkedAdMeta: result.linkedAdMeta,
      actionVersion: result.actionVersion, adVersion: result.adVersion,
      display: { ...item.display, ...(operation === 'status'
        ? { status: value, lastStatusChangeAt: result.changedAt }
        : { dueDate: value, dueAtMs: result.dueAtMs }) },
    } : item));
    setNotice(result.clickUpWarning || (operation === 'status' ? `Status changed to ${value}.` : value ? `Due date set to ${value}.` : 'Due date cleared.'));
  }

  function endDrag() { setDraggedAction(null); setDropTarget(''); }
  function locked(action: ActionRecord) { return creationLocked(creationJobs.find((job)=>job.ad_id===action.display.linkedAdId)); }
  async function dropInto(columnId: string) {
    const snapshot = draggedAction;
    endDrag();
    if (!snapshot) return;
    const status = productionDropStatus(snapshot.display.status, columnId);
    if (status) await saveWorkflow(snapshot, 'status', status);
  }

  return {
    statusOptions: (action: ActionRecord) => workflowStatuses(action.display.status, action.display.clickupTaskId ? statusRules.statuses : undefined),
    statusUnavailable: (action: ActionRecord) => Boolean(action.display.clickupTaskId && (statusRules.loading || statusRules.error || !statusRules.statuses.length)),
    actions, creationJobs, deletedCreatives, mutate, locked, setError, setNotice,
    commitSaved: (saved: {action: Record<string,unknown>;ad: Record<string,unknown> | null}) => {
      const updated=buildActionRecords([saved.action],saved.ad?[saved.ad]:[])[0];
      if(updated)setActions((rows)=>rows.map((row)=>row.display.dbId===updated.display.dbId?updated:row));
    },
    columns: PRODUCTION_COLUMNS.map((column) => ({ ...column, rows: actions.filter((action) => productionBucket(action.display.status) === column.id) })),
    busy, loadedAt, reload, notice, error: error || syncError,
    busyAction: busyAction || (busy ? 'reload' : ''),
    dropTarget, setDropTarget, draggedActionId: draggedAction?.display.dbId || '',
    startDrag: (action: ActionRecord) => { if (!busyAction && !busy && !locked(action)) setDraggedAction(action); },
    endDrag, dropInto: mutate(dropInto),
    updateStatus: mutate((action: ActionRecord, status: string) => saveWorkflow(action, 'status', status)),
    dueAction, openDue: (action: ActionRecord) => { setError(''); setDueAction(action); },
    closeDue: () => setDueAction(null),
    saveDue: mutate(async (value: string) => { if (dueAction) { await saveWorkflow(dueAction, 'due', value); setDueAction(null); } }),
  };
}
