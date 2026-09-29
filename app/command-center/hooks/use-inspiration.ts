'use client';

import { normalizeQueueJob, normalizeWorker, summarizeQueue } from '../../../lib/domain/worker-queue.js';
import type { Product, QueueFilter, QueueJob, WorkerRow } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useState } from 'react';
import { useLiveQuery, type RefreshOptions } from './use-live-query';
import { useReconciledState } from './use-reconciled-state';
import { readProductRows } from '../../../lib/services/product-rows.js';
import { inspirationQueueStatus } from '../../../lib/domain/inspiration-library.js';

export function useInspiration({ supabase, activeProductId, activeProduct }: { supabase: SupabaseClient; activeProductId: string; activeProduct?: Product }) {
  const [jobs, setJobs] = useReconciledState<QueueJob[]>([]);
  const [workers, setWorkers] = useReconciledState<WorkerRow[]>([], (worker) => worker.workerId);
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [loadedAt, setLoadedAt] = useState('');
  const [error, setError] = useState('');

  const { refresh, busy, error: syncError, mutate } = useLiveQuery({
    supabase,
    productId: activeProductId,
    tables: ['inspiration_queue', 'worker_registry'],
    enabled: Boolean(activeProductId),
    load,
    onMutationError: setError,
  });

  async function reload() {
    setError('');
    await refresh();
  }

  async function load(signal: AbortSignal, options: RefreshOptions) {
    const [queueResult, workersResult] = await Promise.all([
      readProductRows(supabase, 'inspiration_queue', activeProductId, signal),
      supabase.from('worker_registry').select('worker_id,hostname,os,python_version,claude_code_version,last_heartbeat,last_job_at,jobs_completed_total,jobs_failed_total,status,current_job_id,capabilities,enabled,created_at').abortSignal(signal).order('last_heartbeat', { ascending: false }),
    ]);
    if (workersResult.error) throw new Error('Some queue data could not be loaded.');
    return () => {
      setJobs(queueResult.filter((row) => row.product_id === activeProductId).map((row) => normalizeQueueJob({ ...row,
        status: inspirationQueueStatus('', row) === 'Blocked' ? 'blocked' : row.status })).sort((a, b) => Date.parse(b.queuedAt) - Date.parse(a.queuedAt)));
      setWorkers(Array.isArray(workersResult.data) ? workersResult.data.map((row) => normalizeWorker(row)) : []);
      if (!options.background) setLoadedAt(new Date().toISOString());
    };
  }

  const summary = summarizeQueue(jobs);
  const filteredJobs = filterJobs(jobs, filter);
  const healthyWorkers = workers.filter((worker) => ['online', 'busy'].includes(worker.health)).length;

  return {
    summary,
    jobs,
    busy,
    reload,
    error: error || syncError,
    loadedAt,
    filter,
    setFilter,
    filteredJobs,
    healthyWorkers,
    workers,
  };
}

function filterJobs(jobs: QueueJob[], filter: QueueFilter) {
  if (filter === 'all') return jobs;
  if (filter === 'active') return jobs.filter((job) => ['claimed', 'classifying', 'processing'].includes(job.status));
  if (filter === 'classified') return jobs.filter((job) => ['classified', 'done'].includes(job.status));
  if (filter === 'failed') return jobs.filter((job) => ['failed', 'error'].includes(job.status));
  return jobs.filter((job) => job.status === filter);
}
