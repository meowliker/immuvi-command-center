'use client';

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Creative } from '../types';
import { trackerRpc, pushTrackerCreative } from '../services/tracker';
import { requestQaClickUp } from '../services/qa-clickup';
import { trackerDraft, trackerSaveValues } from '../../../lib/domain/tracker-editing.js';
import { normalizeCreativeRow } from '../../../lib/domain/creative-tracker.js';

export type TrackerSchema = { fields: { id: string; name: string; type: string; type_config?: { options?: { id: string; name?: string; label?: string; orderindex?: number | string }[] } }[];
  members: { id: number; username?: string; email?: string }[]; mappings: Record<string, string> };
export type TrackerEditor = { kind: 'edit' | 'spawn' | 'winners' | 'delete'; creative: Creative | null } | null;

export function useTrackerActions(db: SupabaseClient, productId: string, commit: (creative: Creative) => void) {
  const [editor, setEditor] = useState<TrackerEditor>(null);
  const [schema, setSchema] = useState<TrackerSchema | null>(null);
  const [notice, setNotice] = useState('');
  const [busyAction, setBusyAction] = useState('');

  async function save(creative: Creative | null, draft: Record<string, string>, custom: Record<string, unknown>, push: boolean) {
    setBusyAction('save');
    const values = trackerSaveValues(draft, creative ? trackerDraft(creative) : null);
    const row = await trackerRpc(db, 'qa_tracker_save', { p_product_id: productId, p_ad_id: creative?.id || null,
      p_expected_updated_at: creative?.version || null, p_values: values, p_custom: custom });
    commit(normalizeCreativeRow(row));
    setEditor(null);
    setNotice('Creative saved.');
    if (push && (row.clickup_task_id || row.meta?._clickupId)) setNotice(await pushTrackerCreative(db, productId, row.id));
  }

  async function inlineStatus(creative: Creative, status: string) {
    await save(creative, { ...trackerDraft(creative), status }, {}, true);
  }

  async function remove(creative: Creative, deleteRemote: boolean) {
    setBusyAction('delete');
    await trackerRpc(db, 'qa_tracker_delete', { p_product_id: productId, p_ad_id: creative.id, p_expected_updated_at: creative.version });
    setEditor(null); setNotice('Creative deleted from QA. Its variations remain independent.');
    if (deleteRemote && creative.clickupTaskId) {
      try {
        await requestQaClickUp(db, productId, { operation: 'delete-creative-task', adId: creative.id });
        setNotice('Creative deleted from QA and its linked test-list ClickUp task deleted.');
      } catch (cause) { setNotice(`Deleted in QA; ClickUp deletion failed. The tombstone prevents re-import. ${cause instanceof Error ? cause.message : ''}`); }
    }
  }

  async function spawn(creative: Creative, kind: string, rows: Record<string, unknown>[], fileId: string) {
    setBusyAction('spawn');
    const result = await trackerRpc(db, 'qa_tracker_spawn', { p_product_id: productId, p_parent_id: creative.id,
      p_expected_updated_at: creative.version, p_kind: kind, p_rows: rows, p_winner_file_id: fileId || null });
    setEditor(null); setNotice(`${result.length} creatives created and assigned to the parent matrix cell.`);
  }

  async function winner(creative: Creative, file: { id: string; name: string }, remove = false) {
    setBusyAction('winner');
    const row = await trackerRpc(db, 'qa_tracker_winner', { p_product_id: productId, p_ad_id: creative.id,
      p_file_id: file.id, p_name: file.name, p_remove: remove });
    const updated = normalizeCreativeRow(row);
    commit(updated); setEditor({ kind: 'winners', creative: updated });
    setNotice(remove ? 'Winning file removed.' : 'Winning file saved.');
  }

  async function shareWinner(creative: Creative, fileId: string) {
    setBusyAction('comment');
    await requestQaClickUp(db, productId, { operation: 'winner-comment', adId: creative.id, fileId });
    setNotice('Winning file posted to the linked ClickUp task.');
  }

  async function loadSchema() {
    setBusyAction('fields');
    setSchema(await requestQaClickUp(db, productId, { operation: 'creative-schema' }));
  }

  async function push(creative: Creative) { setBusyAction('push'); setNotice(await pushTrackerCreative(db, productId, creative.id)); }

  return { editor, setEditor, schema, notice, setNotice, busyAction, setBusyAction, save, inlineStatus, remove, spawn, winner, shareWinner, loadSchema, push };
}
