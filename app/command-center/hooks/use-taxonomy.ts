'use client';

import { readProductRows } from '../../../lib/services/product-rows.js';
import { taxonomyRelationships, taxonomyWorkspace, taxonomyWorkspaceSummary } from '../../../lib/domain/taxonomy-workspace.js';
import {
  filterTaxonomyRows,
  normalizeTaxonomyRow,
} from '../../../lib/domain/taxonomy.js';
import type { Creative, TaxonomyKind, TaxonomyRow, TaxonomyView } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { reconcileDrafts, sameData } from '../../../lib/domain/live-data.js';
import { taxonomyRequest } from '../../../lib/domain/taxonomy-mutations.js';
import { previewTaxonomyRename } from '../../../lib/services/taxonomy-mutations.js';
import { useTaxonomyWrite } from './use-taxonomy-write';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery, type RefreshOptions } from './use-live-query';
import { useReconciledState } from './use-reconciled-state';

export function useTaxonomy({ kind, supabase, activeProductId, userId }: { kind: TaxonomyKind; supabase: SupabaseClient; activeProductId: string; userId: string }) {
  const [rows, setRows] = useReconciledState<TaxonomyRow[]>([]);
  const [creatives, setCreatives] = useReconciledState<Creative[]>([]);
  const [oppositeRows, setOppositeRows] = useReconciledState<TaxonomyRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, TaxonomyRow>>({});
  const [draftVersions, setDraftVersions] = useState<Record<string, string>>({});
  const [mergeOpen, setMergeOpen] = useState(false);
  const [view, setView] = useState<TaxonomyView>('active');
  const [loadedAt, setLoadedAt] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const label = taxonomyLabel(kind);
  const oppositeLabel = kind === 'angle' ? 'personas' : 'angles';
  const write = useTaxonomyWrite(supabase, userId, activeProductId, kind);
  const active = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, [activeProductId, kind]);

  const { refresh, busy, error: syncError, mutate } = useLiveQuery({
    supabase,
    productId: activeProductId,
    tables: ['angles', 'personas', 'ads', 'deleted_ads'],
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
    const [angles, personas, ads, tombstones] = await Promise.all(
      ['angles', 'personas', 'ads', 'deleted_ads'].map((table) => readProductRows(supabase, table, activeProductId, signal)),
    );
    const snapshot = taxonomyWorkspace({ productId: activeProductId, kind, angles, personas, ads, tombstones });
    return () => {
      const nextRows: TaxonomyRow[] = snapshot.rows;
      setRows(nextRows);
      setDrafts((current) => {
        const next = reconcileDrafts(current, rows, nextRows, ['name', 'sourceLink', 'notes']);
        const missing = Object.entries(current).filter(([id, draft]) => !nextRows.some((row) => row.id === id)
          && (!rows.some((row) => row.id === id) || ['name', 'sourceLink', 'notes'].some((field) => !sameData(draft[field as keyof TaxonomyRow], rows.find((row) => row.id === id)?.[field as keyof TaxonomyRow]))));
        return missing.length ? { ...next, ...Object.fromEntries(missing) } : next;
      });
      setCreatives(snapshot.creatives);
      setOppositeRows(snapshot.oppositeRows);
      if (!options.background) setLoadedAt(new Date().toISOString());
    };
  }

  async function addRow() {
    const name = nextTaxonomyName(`New ${label}`, rows);
    await commit(taxonomyRequest(activeProductId, kind, 'create', [], { name, sourceLink: '', notes: '' }));
  }

  async function saveRow(row: TaxonomyRow) {
    const draft = drafts[row.id] || row;
    const request = taxonomyRequest(activeProductId, kind, 'save', [{ ...row, updatedAt: draftVersions[row.id] ?? row.updatedAt }], draft);
    if (request.p_values.fields!.name !== row.name) {
      setBusyAction('preview'); setError(''); setNotice('');
      const preview = await previewTaxonomyRename(supabase, request);
      if (!active.current) return;
      if (!window.confirm(`Rename "${preview.beforeName}" to "${preview.afterName}"?\n\nAffected creatives/tasks: ${preview.counts.ads}\nInspirations: ${preview.counts.inspirations}\nAction Plan records: ${preview.counts.actions}\n\nRelated Matrix cells will also be retagged. Changes are saved atomically in QA with an audit record. ClickUp delivery remains pending, not automatic.`)) return;
      request.p_values.renameRevision = preview.revision;
    }
    await commit(request);
  }

  async function setArchived(row: TaxonomyRow, archived: boolean) {
    if (archived && !window.confirm(`Archive ${label.toLowerCase()} "${row.name}"?\n\nIt will be hidden from active taxonomy views. Existing creatives keep their tagging.`)) return;
    await commit(taxonomyRequest(activeProductId, kind, archived ? 'archive' : 'restore', [row]));
  }

  async function deleteRow(row: TaxonomyRow) {
    if (!window.confirm(`Delete ${label.toLowerCase()} "${row.name}"?\n\nRelated creative, inspiration and action tags will be cleared, and its Matrix cells and relationships removed. Creatives themselves will not be deleted.`)) return;
    await commit(taxonomyRequest(activeProductId, kind, 'delete', [row]));
  }

  async function commit(request: ReturnType<typeof taxonomyRequest>) {
    setBusyAction(request.p_operation); setError(''); setNotice('');
    const result = await write.submit(request);
    if (!result) return;
    // Live reads pause during writes; expose the verified version before unpausing.
    setRows((current) => {
      const remaining = current.filter((row) => !result.removedIds.includes(row.id));
      if (!result.row) return remaining;
      const saved = normalizeTaxonomyRow(result.row);
      return remaining.some((row) => row.id === saved.id)
        ? remaining.map((row) => row.id === saved.id ? saved : row) : [...remaining, saved];
    });
    const ids = request.p_values.sources.map((row: { id: string }) => row.id);
    setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !ids.includes(id))));
    setDraftVersions((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !ids.includes(id))));
    setMergeOpen(false);
    await reload({ notice: `${label} ${request.p_operation} saved in QA.${result.remotePending ? ` ${result.remotePending} creative(s) have pending ClickUp changes.` : ''}` });
  }

  function reviewDraft(row: TaxonomyRow) {
    const draft = drafts[row.id] || row;
    const differences = (['name', 'sourceLink', 'notes'] as const).filter((key) => draft[key] !== row[key])
      .map((key) => `${key}:\nCurrent: ${row[key] || '(empty)'}\nYour draft: ${draft[key] || '(empty)'}`).join('\n\n');
    if (window.confirm(`Review current values before retrying your draft:\n\n${differences}`)) setDraftVersions((current) => ({ ...current, [row.id]: row.updatedAt }));
  }

  function setDraftField(row: TaxonomyRow, field: keyof Pick<TaxonomyRow, 'name' | 'sourceLink' | 'notes'>, value: string) {
    setDraftVersions((current) => Object.hasOwn(current, row.id) ? current : { ...current, [row.id]: row.updatedAt });
    setDrafts((current) => ({ ...current, [row.id]: { ...(current[row.id] || row), [field]: value } }));
  }

  const relationships = useMemo(() => new Map(rows.map((row) => [row.id, taxonomyRelationships(kind, row, creatives, oppositeRows)])), [kind, rows, creatives, oppositeRows]);
  const summary = useMemo(() => taxonomyWorkspaceSummary(rows, relationships), [rows, relationships]);
  const visibleRows = filterTaxonomyRows(rows, view);

  return {
    summary,
    rows,
    relationships,
    readError: syncError,
    writeReady: write.ready,
    pending: write.pending,
    retry: mutate(async () => { if (write.pending) await commit(write.pending); }),
    draftVersions,
    reviewDraft,
    discardDraft: (row: TaxonomyRow) => {
      setDrafts((current) => { const next = { ...current }; if (rows.some((item) => item.id === row.id)) next[row.id] = row; else delete next[row.id]; return next; });
      setDraftVersions((current) => { const next = { ...current }; delete next[row.id]; return next; });
    },
    mergeOpen,
    setMergeOpen,
    mergeRows: mutate(async (sources: TaxonomyRow[], target: TaxonomyRow) => { await commit(taxonomyRequest(activeProductId, kind, 'merge', sources, null, target)); }),
    label,
    busyAction: busyAction || (busy ? 'reload' : ''),
    addRow: mutate(addRow),
    reload,
    notice,
    error: error || write.error || syncError,
    loadedAt,
    view,
    setView,
    visibleRows,
    drafts,
    unavailableDrafts: Object.values(drafts).filter((draft) => !rows.some((row) => row.id === draft.id)),
    creatives,
    setDraftField,
    oppositeLabel,
    saveRow: mutate(saveRow),
    setArchived: mutate(setArchived),
    deleteRow: mutate(deleteRow),
  };
}

function taxonomyLabel(kind: TaxonomyKind) {
  return kind === 'angle' ? 'Angle' : 'Persona';
}

function nextTaxonomyName(baseName: string, rows: TaxonomyRow[]) {
  const existing = new Set(rows.map((row) => row.name.toLowerCase()));
  if (!existing.has(baseName.toLowerCase())) return baseName;
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${baseName} ${index}`;
    if (!existing.has(candidate.toLowerCase())) return candidate;
  }
  return `${baseName} ${Date.now().toString(36)}`;
}
