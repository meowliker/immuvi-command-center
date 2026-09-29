'use client';

import { actionPlanBucket, isActionOverdue, normalizeActionAd } from '../../../lib/domain/action-plan.js';
import { buildActionRecords } from '../helpers/actions';
import { persistActionDueDate, persistActionStatus } from '../services/actions';
import type { ActionFilter, ActionRecord, Product } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useState } from 'react';
import { useLiveQuery, type RefreshOptions } from './use-live-query';
import { useReconciledState } from './use-reconciled-state';
import { pushPlanCreative,type CreationJob } from '../services/plan-workflow';
import { readProductRows } from '../../../lib/services/product-rows.js';
import { savePlanBatch } from '../../../lib/services/action-plan-bulk.js';
import { usePlanBulk, type PlanBulkOperation } from './use-plan-bulk';
import { trackerRpc } from '../services/tracker';
import { requestQaClickUp } from '../services/qa-clickup';
import { canEditPlanTitle, explicitPlanSource } from '../../../lib/domain/action-plan-editing.js';
import { planLifecycleRows } from '../../../lib/domain/action-plan-visibility.js';
import { virtualPlanActions, planPresentationKeys, adoptedIdReplacements } from '../../../lib/domain/action-plan-adoption.js';
import { promotePlanAction, readRemovedPlanIds } from '../../../lib/services/action-plan-adoption.js';
import { PLAN_BATCH_LIMIT } from '../../../lib/domain/action-plan-workspace.js';
import { deletedPlanTargets } from '../../../lib/domain/action-plan-deletion.js';
import { usePlanStatuses } from './use-plan-statuses';
import { productClickUpListId } from '../../../lib/domain/product-config.js';
import { workflowStatuses } from '../helpers/creatives';
import { usePlanFieldSchema } from './use-plan-field-schema';
import { usePlanEditQueue, type PlanEdit } from './use-plan-edit-queue';
import { readPlanEditSnapshot } from '../services/plan-edit-snapshot';

export function useActionPlan({ supabase, activeProductId, activeProduct }: { supabase: SupabaseClient; activeProductId: string; activeProduct?: Product }) {
  const statusRules = usePlanStatuses(supabase, activeProductId, productClickUpListId(activeProduct));
  const fieldSchema = usePlanFieldSchema(supabase, activeProductId, productClickUpListId(activeProduct));
  const [storedActions, setActions] = useReconciledState<ActionRecord[]>([], (action) => action.display.dbId);
  const [ageAds, setAgeAds] = useReconciledState<ReturnType<typeof normalizeActionAd>[]>([]);
  const [inspirations, setInspirations] = useReconciledState<Record<string, unknown>[]>([]);
  const [deletedCreatives, setDeletedCreatives] = useReconciledState<ReturnType<typeof deletedPlanTargets>>([]);
  const [filter, setFilter] = useState<ActionFilter>('all');
  const [loadedAt, setLoadedAt] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [selectedActionId, setSelectedActionId] = useState('');
  const [creationJobs,setCreationJobs] = useReconciledState<CreationJob[]>([]);
  const edits = usePlanEditQueue(activeProductId, storedActions, setError, setNotice);
  const actions = edits.actions;
  const bulk = usePlanBulk(supabase, activeProductId);

  const { refresh, busy, error: syncError, mutate } = useLiveQuery({
    supabase,
    productId: activeProductId,
    tables: ['manual_actions', 'ads', 'deleted_ads', 'qa_clickup_creations', 'activity_events', 'inspirations'],
    enabled: Boolean(activeProductId),
    load,
    onMutationError: setError,
    onMutationEnd: () => setBusyAction(''),
  });

  async function reload() {
    setError('');
    await refresh();
  }

  async function load(signal: AbortSignal, options: RefreshOptions) {
    const [manualActionsResult, adsResult, jobs, tombstones, removedIds, inspirationRows] = await Promise.all([
      readProductRows(supabase,'manual_actions',activeProductId,signal),
      readProductRows(supabase,'ads',activeProductId,signal),
      readProductRows(supabase,'qa_clickup_creations',activeProductId,signal),
      readProductRows(supabase,'deleted_ads',activeProductId,signal),
      readRemovedPlanIds(supabase, activeProductId, signal),
      readProductRows(supabase, 'inspirations', activeProductId, signal, 'id,product_id,data'),
    ]);
    return () => {
      const nextActions = buildActionRecords([...manualActionsResult].sort((a,b) => Date.parse(b.updated_at)-Date.parse(a.updated_at)), adsResult, tombstones);
      const combined = [...nextActions, ...virtualPlanActions(nextActions, manualActionsResult, adsResult, tombstones, removedIds)];
      const replacements = adoptedIdReplacements(actions, combined) as Map<string, string>;
      setSelectedActionId((id) => replacements.get(id) || id);
      bulk.replaceIds(replacements);
      setActions(combined);
      setDeletedCreatives(deletedPlanTargets(activeProductId, adsResult, tombstones));
      setAgeAds(planLifecycleRows([], adsResult, tombstones).ads.map(normalizeActionAd));
      setInspirations(inspirationRows);
      setCreationJobs(jobs);
      if (!options.background) setLoadedAt(new Date().toISOString());
    };
  }

  const filtered = filter === 'all' ? actions : actions.filter((action) => filter === 'overdue' ? isActionOverdue(action.display) : actionPlanBucket(action.display.status) === filter);
  const selectedAction = actions.find((action) => action.display.dbId === selectedActionId) || null;

  // Called only inside the existing mutation lock, never while rendering/loading.
  async function promote(action: ActionRecord): Promise<ActionRecord> {
    if (!action.display.isVirtual) return action;
    const saved = await promotePlanAction(supabase, activeProductId, action);
    setActions((rows) => [...rows.filter((row) => row.display.dbId !== action.display.dbId && row.display.dbId !== saved.display.dbId), saved]);
    setSelectedActionId((id) => id === action.display.dbId ? saved.display.dbId : id);
    bulk.replaceId(action.display.dbId, saved.display.dbId);
    return saved;
  }

  function updateWorkflow(action: ActionRecord, kind: 'status' | 'due', value: string) {
    const edit: PlanEdit = { kind, value, changedAt: Date.now() };
    setError(''); setNotice('');
    return edits.run(action, edit, async (baseline, remember) => {
      const current = await readPlanEditSnapshot(supabase, activeProductId, await promote(baseline), edit);
      const result = await (kind === 'status' ? persistActionStatus : persistActionDueDate)(supabase, activeProductId, current, value);
      const updated = { ...current, payload: result.payload, linkedAdMeta: result.linkedAdMeta, actionVersion: result.actionVersion, adVersion: result.adVersion,
        display: { ...current.display, ...(kind === 'status' ? { status: value, lastStatusChangeAt: result.changedAt } : { dueDate: value, dueAtMs: result.dueAtMs }) } };
      setActions(rows => rows.map(row => row.display.dbId === current.display.dbId ? updated : row));
      remember(updated);
      if (result.clickUpWarning) throw new Error(result.clickUpWarning);
    }, mutate);
  }

  async function retryClickUp(action: ActionRecord) {
    setError(''); setNotice(''); setBusyAction(`retry:${action.display.dbId}`);
    const result = await requestQaClickUp(supabase, activeProductId, {
      operation: 'push-creative', adId: action.display.linkedAdId,
      ...(action.display.isVirtual ? {} : { actionId: action.display.dbId }),
    });
    if (result.failed?.length) throw new Error(`ClickUp changes remain pending: ${result.failed.map((field: { field: string; error: string }) => `${field.field}: ${field.error}`).join('; ')}`);
    setNotice(result.pushed ? 'Pending changes sent to ClickUp.' : 'No pending changes to send.');
  }

  async function removeFromPlan(action: ActionRecord) {
    if (action.display.isVirtual) throw new Error('Use Hide from my plan for an adopted task.');
    if (!window.confirm(`Remove "${action.display.title || 'this task'}" from Action Plan?\n\nThe linked creative and ClickUp task will not be deleted.`)) return;
    const key = `remove:${action.display.dbId}`;
    setBusyAction(key);
    setError('');
    setNotice('');
    await savePlanBatch(supabase, activeProductId, [action], 'remove');
      setActions((current) => current.filter((item) => item.display.dbId !== action.display.dbId));
      setSelectedActionId('');
      setNotice('Task removed from Action Plan. Its creative and ClickUp task were preserved.');
    setBusyAction('');
  }

  async function pushToClickUp(action:ActionRecord,taskId?:string) {
    setError(''); setNotice(''); setBusyAction(`push:${action.display.dbId}`);
    action = await promote(action);
    setNotice(await pushPlanCreative(supabase,activeProductId,action.display.linkedAdId,taskId,action.display.dbId));
  }

  async function runBulk(selection: ActionRecord[], operation: PlanBulkOperation, value?: string) {
    setError(''); setNotice(''); setBusyAction('bulk');
    if (!selection.length || selection.length > PLAN_BATCH_LIMIT) throw new Error(`Select between 1 and ${PLAN_BATCH_LIMIT} tasks.`);
    if (operation === 'remove' && selection.some((action) => action.display.isVirtual)) throw new Error('Use Hide from my plan for adopted tasks.');
    const links = selection.map((action) => action.display.linkedAdId).filter(Boolean);
    if (new Set(links).size !== links.length || selection.some((action) => action.display.productId !== activeProductId)) throw new Error('Resolve duplicate or foreign task links before bulk editing.');
    const prepared: ActionRecord[] = [];
    for (const action of selection) prepared.push(await promote(action));
    await bulk.run(prepared, operation, value);
  }

  function openFields(action: ActionRecord) {
    setError('');
    if (!action.display.linkedAdId || (action.payload.sourceAdId || action.payload.adId || action.payload._sourceAdId) !== action.display.linkedAdId) {
      setError('Link this action to its creative before editing assignments.'); return;
    }
    setSelectedActionId(action.display.dbId);
  }

  async function saveFields(action: ActionRecord, changes: Record<string, unknown>, push: boolean) {
    const edit: PlanEdit = { kind: 'fields', values: changes };
    setError(''); setNotice('');
    return edits.run(action, edit, async (baseline, remember) => {
      action = await readPlanEditSnapshot(supabase, activeProductId, await promote(baseline), edit);
      const result = await trackerRpc(supabase, 'qa_plan_fields', { p_product_id: activeProductId, p_action_id: action.display.dbId,
        p_expected_updated_at: action.actionVersion, p_ad_id: action.display.linkedAdId, p_ad_updated_at: action.adVersion, p_custom: changes });
      const updated = buildActionRecords([result.action], [result.ad])[0];
      setActions(rows => rows.map(row => row.display.dbId === action.display.dbId ? updated : row));
      remember(updated);
      if (Object.keys(changes).length && push && (result.ad.clickup_task_id || result.ad.meta?._clickupId || result.ad.meta?.clickupTaskId)) {
        await pushEditedFields(action, result.ad.id);
      }
    }, mutate);
  }

  async function pushEditedFields(action: ActionRecord, adId: string) {
    try {
      const pushed = await requestQaClickUp(supabase, activeProductId, { operation: 'push-creative', adId, actionId: action.display.dbId });
      if (pushed.failed?.length) throw new Error(pushed.failed.map((f: { field: string; error: string }) => `${f.field}: ${f.error}`).join('; '));
    } catch (cause) { throw new Error(`Saved in QA. ClickUp changes remain pending: ${cause instanceof Error ? cause.message : 'Request failed.'}`); }
  }

  function openCreative(action: ActionRecord) {
    setError('');
    if (!action.display.linkedAdId || explicitPlanSource(action) !== action.display.linkedAdId) {
      setError('Link this action to its creative before editing creative details.'); return;
    }
    setSelectedActionId(action.display.dbId);
  }

  async function saveCreative(action: ActionRecord, values: Record<string, unknown>, push: boolean) {
    const edit: PlanEdit = { kind: 'creative', values };
    setError(''); setNotice('');
    return edits.run(action, edit, async (baseline, remember) => {
      if (!canEditPlanTitle(baseline)) throw new Error('Action Plan source identity is unresolved.');
      action = await readPlanEditSnapshot(supabase, activeProductId, await promote(baseline), edit);
      const result = await trackerRpc(supabase, 'qa_plan_creative', { p_product_id: activeProductId, p_action_id: action.display.dbId,
        p_expected_updated_at: action.actionVersion, p_ad_id: action.display.linkedAdId || null,
        p_ad_updated_at: action.adVersion || null, p_values: values });
      const updated = buildActionRecords([result.action], result.ad ? [result.ad] : [])[0];
      setActions((current) => current.map((item) => item.display.dbId === action.display.dbId ? updated : item));
      remember(updated);
      if (push && result.ad && Object.keys(values).length && action.display.clickupTaskId) {
        await pushEditedFields(action, result.ad.id);
      }
    }, mutate);
  }

  return {
    busy,
    reload,
    notice,
    error: error || syncError,
    loadedAt,
    filter,
    setFilter,
    selectedAction,
    filtered,
    selectedActionId,
    busyAction: busyAction || (edits.pending ? 'edits' : busy ? 'reload' : ''),
    editingBusy: Boolean(busyAction || busy),
    updateStatus: (action: ActionRecord, status: string) => updateWorkflow(action, 'status', status),
    statusRules,
    statusOptions: (action: ActionRecord) => workflowStatuses(action.display.status, action.display.clickupTaskId ? statusRules.statuses : undefined),
    statusUnavailable: (action: ActionRecord) => Boolean(action.display.clickupTaskId && (statusRules.loading || statusRules.error || !statusRules.statuses.length)),
    updateDueDate: (action: ActionRecord, due: string) => updateWorkflow(action, 'due', due),
    retryClickUp: mutate(retryClickUp),
    setSelectedActionId,
    removeFromPlan: mutate(removeFromPlan),
    creationJobs,pushToClickUp:mutate(pushToClickUp),
    actions,
    presentationKeys: planPresentationKeys(actions) as Map<string, string>,
    ageAds,
    inspirations,
    deletedCreatives,
    mutate,
    promote,
    bulk: { ...bulk, run: mutate(runBulk) },
    fieldSchema, openFields, saveFields,
    openCreative, saveCreative,
  };
}
