'use client';

import {
  creativeFilterOptions,
  filterCreativeTrackerRows,
  sortCreativeTrackerRows,
  summarizeCreativeTracker,
} from '../../../lib/domain/creative-tracker.js';
import type { Creative, MatrixCell, Product, TrackerFilters, TrackerSort, TrackerSortColumn } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useState } from 'react';
import { useLiveQuery, type RefreshOptions } from './use-live-query';
import { useReconciledState } from './use-reconciled-state';
import { loadTrackerData } from '../services/tracker';
import { useTrackerActions } from './use-tracker-actions';

export const defaultTrackerFilters: TrackerFilters = {
  angle: '',
  persona: '',
  format: '',
  adType: '',
  funnelStage: '',
  status: '',
  structure: '',
  hookType: '',
  productionStyle: '',
  taskType: '',
  dateRange: '',
};

export function useCreativeTracker({ supabase, activeProductId, activeProduct }: { supabase: SupabaseClient; activeProductId: string; activeProduct?: Product }) {
  const [creatives, setCreatives] = useReconciledState<Creative[]>([]);
  const [matrixCells, setMatrixCells] = useReconciledState<MatrixCell[]>([]);
  const [filters, setFilters] = useState<TrackerFilters>(defaultTrackerFilters);
  const [sort, setSortState] = useState<TrackerSort>({ col: 'id', dir: 1 });
  const [loadedAt, setLoadedAt] = useState('');
  const [error, setError] = useState('');
  const [taxonomy, setTaxonomy] = useState<{ angles: string[]; personas: string[]; angleNames: Record<string, string>; personaNames: Record<string, string> }>({ angles: [], personas: [], angleNames: {}, personaNames: {} });
  const actions = useTrackerActions(supabase, activeProductId, (creative) => setCreatives((rows) => rows.map((row) => row.id === creative.id ? creative : row)));

  const { refresh, busy, error: syncError, mutate } = useLiveQuery({
    supabase,
    productId: activeProductId,
    tables: ['ads', 'deleted_ads', 'matrix_cells', 'angles', 'personas'],
    enabled: Boolean(activeProductId),
    load,
    onMutationError: setError,
    onMutationEnd: () => actions.setBusyAction(''),
  });

  async function reload() {
    setError('');
    await refresh();
  }

  async function load(signal: AbortSignal, options: RefreshOptions) {
    const data = await loadTrackerData(supabase, activeProductId, signal);
    return () => {
      setCreatives(data.creatives);
      setMatrixCells(data.cells as MatrixCell[]);
      setTaxonomy({ angles: data.angles.filter((row) => !row.archived_at).map((row) => row.name), personas: data.personas.filter((row) => !row.archived_at).map((row) => row.name),
        angleNames: Object.fromEntries(data.angles.map((row) => [row.id, row.name])), personaNames: Object.fromEntries(data.personas.map((row) => [row.id, row.name])) });
      if (!options.background) setLoadedAt(new Date().toISOString());
    };
  }

  function setFilter<K extends keyof TrackerFilters>(key: K, value: TrackerFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function setSort(col: TrackerSortColumn) {
    setSortState((current) => ({ col, dir: current.col === col && current.dir === 1 ? -1 : 1 }));
  }

  const summary = summarizeCreativeTracker(creatives);
  const options = creativeFilterOptions(creatives);
  const filtered = sortCreativeTrackerRows(filterCreativeTrackerRows(creatives, filters), sort);
  const run = <Args extends unknown[]>(operation: (...args: Args) => Promise<unknown>) => mutate(async (...args: Args) => {
    setError(''); actions.setNotice('');
    return operation(...args);
  });

  return {
    actions: { ...actions, save: run(actions.save), inlineStatus: run(actions.inlineStatus), remove: run(actions.remove),
      spawn: run(actions.spawn), winner: run(actions.winner), shareWinner: run(actions.shareWinner), loadSchema: run(actions.loadSchema), push: run(actions.push),
      open: (kind: 'edit' | 'spawn' | 'winners' | 'delete', creative: Creative | null) => { setError(''); actions.setNotice(''); actions.setEditor({ kind, creative }); },
    },
    taxonomy,
    summary,
    busy,
    reload,
    error: error || syncError,
    filtered,
    loadedAt,
    filters,
    setFilter,
    options,
    setFilters,
    setSort,
    sort,
    creatives,
    matrixCells,
  };
}
