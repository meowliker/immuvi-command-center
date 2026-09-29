'use client';
import { useMemo, useState } from 'react';
import { findTaxonomyMergeSuggestions } from '../../../lib/domain/taxonomy.js';
import { TrackerDialog } from './tracker-dialog';
import type { Creative, TaxonomyKind, TaxonomyRow } from '../types';
import styles from '../../command-center.module.css';

export function TaxonomyMergeDialog({ kind, rows, creatives, busy, pending, error, close, merge, retry }: {
  kind: TaxonomyKind; rows: TaxonomyRow[]; creatives: Creative[]; busy: boolean; pending: boolean; error: string;
  close: () => void; merge: (sources: TaxonomyRow[], target: TaxonomyRow) => Promise<unknown>; retry: () => Promise<unknown>;
}) {
  const [snapshot] = useState(rows);
  const [targetId, setTargetId] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  const suggestions = useMemo(() => findTaxonomyMergeSuggestions(kind, snapshot, creatives), [kind, snapshot, creatives]);
  const target = snapshot.find((row) => row.id === targetId);
  return <TrackerDialog title={`Merge ${kind === 'angle' ? 'angles' : 'personas'}`} busy={busy} error={error} onClose={close} closeLabel="Close merge">
    <form className={styles.taxonomyMerge} onSubmit={(event) => { event.preventDefault(); if (target && ids.length) void merge(snapshot.filter((row) => ids.includes(row.id)), target); }}>
      <fieldset disabled={busy || pending}>
        <label>Keep<select aria-label="Keep taxonomy entry" value={targetId} onChange={(event) => { setTargetId(event.target.value); setIds((current) => current.filter((id) => id !== event.target.value)); }}><option value="">Choose entry</option>{snapshot.filter((row) => !row.archivedAt).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        {suggestions.length > 0 && <details><summary>Suggested merges</summary><ul>{suggestions.map((item) => <li key={item.id}><button type="button" onClick={() => { setTargetId(item.keep.id); setIds([item.merge.id]); }}>{item.merge.name} into {item.keep.name}</button><span>{item.reason}</span></li>)}</ul></details>}
        <div className={styles.taxonomyMergeChoices} role="group" aria-label="Entries to merge">{snapshot.filter((row) => row.id !== targetId).map((row) => <label key={row.id}><input type="checkbox" checked={ids.includes(row.id)} onChange={(event) => setIds((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))} /><span>{row.name}{row.archivedAt ? ' (Archived)' : ''}</span></label>)}</div>
        {target && ids.length > 0 && <p role="status">{ids.length} {kind}{ids.length === 1 ? '' : 's'} will be removed. Keep: {target.name}.</p>}
      </fieldset>
      <footer><button type="button" disabled={busy} onClick={close}>Cancel</button>{pending ? <button type="button" disabled={busy} onClick={() => void retry()}>Retry same request</button> : <button type="submit" disabled={busy || !target || !ids.length || ids.length > 50}>Merge</button>}</footer>
    </form>
  </TrackerDialog>;
}
