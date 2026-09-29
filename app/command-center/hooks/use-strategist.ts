'use client';

import { productClickUpListId } from '../../../lib/domain/product-config.js';
import {
  normalizeStrategistApprovalResult,
  normalizeStrategistMemory,
  normalizeStrategistRecommendation,
  normalizeStrategistRun,
} from '../helpers/strategist';
import { objectRecord } from '../helpers/values';
import { createRecommendationClickUpTask } from '../services/clickup';
import { qaClickUpToken } from '../services/qa-clickup';
import type { Product, StrategistMemory, StrategistRecommendation, StrategistRun } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useState } from 'react';
import { useLiveQuery, type RefreshOptions } from './use-live-query';
import { useReconciledState } from './use-reconciled-state';

export function useStrategist({
  supabase,
  activeProductId,
  activeProduct,
  userId,
}: {
  supabase: SupabaseClient;
  activeProductId: string;
  activeProduct?: Product;
  userId: string;
}) {
  const [memory, setMemory] = useReconciledState<StrategistMemory | null>(null);
  const [run, setRun] = useReconciledState<StrategistRun | null>(null);
  const [recommendations, setRecommendations] = useReconciledState<StrategistRecommendation[]>([]);
  const [view, setView] = useState<'pending' | 'approved' | 'rejected' | 'tasked'>('pending');
  const [memoryView, setMemoryView] = useState<'narrative' | 'structured'>('narrative');
  const [loadedAt, setLoadedAt] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busyAction, setBusyAction] = useState('');

  const { refresh, busy, error: syncError, mutate } = useLiveQuery({
    supabase,
    productId: activeProductId,
    tables: ['strategist_memory', 'strategist_runs', 'strategist_recommendations', 'competitor_creatives'],
    enabled: Boolean(activeProductId),
    load,
    onMutationError: setError,
    onMutationEnd: () => setBusyAction(''),
  });

  async function reload(options: { notice?: string } = {}) {
    setError('');
    if (options.notice) setNotice(options.notice);
    await refresh();
  }

  async function load(signal: AbortSignal, options: RefreshOptions) {
    const [memoryResult, runsResult, recsResult] = await Promise.all([
      supabase.from('strategist_memory').select('*').abortSignal(signal).eq('product_id', activeProductId).maybeSingle(),
      supabase.from('strategist_runs').select('*').abortSignal(signal).eq('product_id', activeProductId).order('created_at', { ascending: false }).limit(1),
      supabase.from('strategist_recommendations').select('*, competitor_creatives(brand_id,hook,angle,persona,ad_url,visual_pattern,why_it_works,rank_in_brand,status_label)').abortSignal(signal).eq('product_id', activeProductId).order('generated_at', { ascending: false }),
    ]);
    if (memoryResult.error || runsResult.error || recsResult.error) throw new Error('Some Strategist data could not be loaded. The QA database may still need recommendation tables/migrations.');
    return () => {
      setMemory(memoryResult.data ? normalizeStrategistMemory(memoryResult.data) : null);
      setRun(Array.isArray(runsResult.data) && runsResult.data[0] ? normalizeStrategistRun(runsResult.data[0]) : null);
      setRecommendations(Array.isArray(recsResult.data) ? recsResult.data.map(normalizeStrategistRecommendation) : []);
      if (!options.background) setLoadedAt(new Date().toISOString());
    };
  }

  async function queueRun() {
    if (!window.confirm('Queue a manual strategist run for this product? A strategist worker must be running to process it.')) return;
    setBusyAction('queue-run');
    const result = await supabase.from('strategist_runs').insert({
      product_id: activeProductId,
      status: 'pending',
      trigger: 'manual',
      run_date: new Date().toISOString().slice(0, 10),
    });
    setBusyAction('');
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await reload({ notice: 'Strategist run queued.' });
  }

  async function updateRecommendation(rec: StrategistRecommendation, status: 'approved' | 'rejected') {
    const reason = status === 'rejected' ? window.prompt('Reject reason (optional):', '') : '';
    if (reason === null) return;
    setBusyAction(`rec:${rec.id}`);
    const result = await supabase.from('strategist_recommendations').update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
      rejection_reason: status === 'rejected' ? reason || null : null,
    }).eq('id', rec.id);
    setBusyAction('');
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await reload({ notice: `Recommendation ${status}.` });
  }

  async function approveAndTest(rec: StrategistRecommendation) {
    if (!rec.recommendedAngle.trim() || !rec.recommendedPersona.trim()) {
      setError('This recommendation needs both an angle and a persona before it can become a test.');
      return;
    }
    if (!window.confirm(
      `Approve and create this test?\n\nAngle: ${rec.recommendedAngle}\nPersona: ${rec.recommendedPersona}\nFormat: ${rec.recommendedFormat || '-'}\n\nThis creates the inspiration, matrix creative, and Action Plan item. ClickUp is added when a linked list and API key are available.`,
    )) return;

    setBusyAction(`test:${rec.id}`);
    setError('');
    setNotice('');
    const approval = await supabase.rpc('approve_strategist_recommendation', {
      p_recommendation_id: rec.id,
      p_product_id: activeProductId,
    });
    if (approval.error) {
      setBusyAction('');
      setError(approval.error.message);
      return;
    }

    const created = normalizeStrategistApprovalResult(approval.data);
    const clickUpListId = activeProduct ? productClickUpListId(activeProduct) : '';
    const clickUpToken = qaClickUpToken(userId);
    if (!clickUpListId || !clickUpToken) {
      setBusyAction('');
      await reload({ notice: 'Test created in Inspiration, Creative Matrix, and Action Plan. ClickUp was skipped because this browser has no linked list or API key.' });
      return;
    }

    try {
      const clickUpTaskId = await createRecommendationClickUpTask(supabase, activeProductId, rec.id);
      const actionResult = await supabase.from('manual_actions').select('payload').eq('id', created.manualActionDbId).maybeSingle();
      const existingPayload = objectRecord(actionResult.data?.payload);
      const clickUpUrl = `https://app.clickup.com/t/${clickUpTaskId}`;
      const [adUpdate, actionUpdate, recommendationUpdate] = await Promise.all([
        supabase.from('ads').update({ clickup_task_id: clickUpTaskId, updated_at: new Date().toISOString() }).eq('id', created.adId),
        supabase.from('manual_actions').update({
          payload: {
            ...existingPayload,
            clickupTaskId: clickUpTaskId,
            _clickupId: clickUpTaskId,
            _clickupUrl: clickUpUrl,
          },
          updated_at: new Date().toISOString(),
        }).eq('id', created.manualActionDbId),
        supabase.from('strategist_recommendations').update({
          task_id: clickUpTaskId,
          task_created_at: new Date().toISOString(),
        }).eq('id', rec.id),
      ]);
      if (actionResult.error || adUpdate.error || actionUpdate.error || recommendationUpdate.error) {
        throw new Error((actionResult.error || adUpdate.error || actionUpdate.error || recommendationUpdate.error)?.message || 'ClickUp task created, but its local link could not be saved.');
      }
      setBusyAction('');
      await reload({ notice: `Test created and pushed to ClickUp as ${clickUpTaskId}.` });
    } catch (clickUpError) {
      setBusyAction('');
      await reload({ notice: 'The test was created locally. ClickUp could not be completed, so it can be pushed later from Action Plan.' });
      setError(clickUpError instanceof Error ? clickUpError.message : 'ClickUp task creation failed.');
    }
  }

  const filtered = recommendations.filter((rec) => rec.status === view);
  const stats = objectRecord(memory?.json.stats);

  return {
    stats,
    run,
    busyAction: busyAction || (busy ? 'reload' : ''),
    reload,
    queueRun: mutate(queueRun),
    notice,
    error: error || syncError,
    memory,
    loadedAt,
    memoryView,
    setMemoryView,
    filtered,
    view,
    setView,
    approveAndTest: mutate(approveAndTest),
    updateRecommendation: mutate(updateRecommendation),
  };
}
