import { useState } from 'react';
import { Archive, RotateCcw, Save, Trash2, RefreshCw, Plus, Merge, Undo2, ExternalLink } from 'lucide-react';
import { TaxonomyRelationships } from '../components/taxonomy-relationships';
import { TaxonomyMergeDialog } from '../components/taxonomy-merge-dialog';
import styles from '../../command-center.module.css';
import parity from '../taxonomy.module.css';
import { inspirationLink } from '../../../lib/domain/inspiration-library.js';
import { creativeStatusClass } from '../helpers/status-styles';
import { useTaxonomy } from '../hooks/use-taxonomy';
import type { TaxonomyKind } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';

export function TaxonomyTab({ kind, supabase, activeProductId, userId, openCreative }: { kind: TaxonomyKind; supabase: SupabaseClient; activeProductId: string; userId: string; openCreative: (id: string) => void }) {
  const [selected, setSelected] = useState<{ id: string; view: 'relationships' | 'creatives' } | null>(null);
  const {
    summary,
    rows,
    relationships,
    readError,
    writeReady, pending, retry, draftVersions, reviewDraft, discardDraft, mergeOpen, setMergeOpen, mergeRows, creatives,
    label,
    busyAction,
    addRow,
    reload,
    notice,
    error,
    loadedAt,
    view,
    setView,
    visibleRows,
    drafts,
    unavailableDrafts,
    setDraftField,
    oppositeLabel,
    saveRow,
    setArchived,
    deleteRow,
  } = useTaxonomy({ kind, supabase, activeProductId, userId });
  const writesDisabled = Boolean(busyAction || readError || !loadedAt || !activeProductId || !writeReady || pending);
  const dirty = rows.some((row) => { const draft = drafts[row.id]; return draft && (draft.name !== row.name || draft.sourceLink !== row.sourceLink || draft.notes !== row.notes); });

  return (
    <div className={parity.surface}>
      <section className={parity.toolbar}>
        <h2>{label} Tracker</h2>
        <button disabled={writesDisabled} type="button" onClick={addRow}><Plus size={14}/>{busyAction === 'create' ? 'Adding...' : `Add ${label}`}</button>
        <button disabled={writesDisabled || dirty || rows.length < 2} title={dirty ? 'Save or discard drafts before merging' : `Merge ${label.toLowerCase()}s`} type="button" onClick={() => setMergeOpen(true)}><Merge size={14}/>Merge {label}s</button>
        <button aria-label={busyAction === 'reload' ? 'Refreshing...' : 'Refresh'} title="Refresh taxonomy" disabled={busyAction === 'reload'} type="button" onClick={() => reload()}><RefreshCw size={14}/></button>
      </section>
      <section className={parity.summary} aria-label={`${label} summary`}>
        <span>Total {label}s: <strong>{loadedAt ? summary.total : '-'}</strong></span>
        <span>Winners: <strong>{loadedAt ? summary.winners : '-'}</strong></span>
        <span>Testing: <strong>{loadedAt ? summary.testing : '-'}</strong></span>
        <span>Untested: <strong>{loadedAt ? summary.untested : '-'}</strong></span>
        <span>Total Creatives: <strong>{loadedAt ? summary.totalCreatives : '-'}</strong></span>
      </section>
      {notice ? <div className={styles.notice}>{notice}</div> : null}
      {error ? <div role="alert" className={styles.error}>{error}{readError && loadedAt ? ' Showing the last successful snapshot.' : ''}</div> : null}
      {pending && <div role="status" className={styles.notice}>{busyAction ? 'Saving taxonomy...' : <>A taxonomy request needs acknowledgement. <button type="button" onClick={() => void retry()}>Retry same request</button></>}</div>}
      {!loadedAt && <p role="status">{!activeProductId ? 'No product selected.' : readError ? 'Taxonomy data unavailable.' : 'Loading taxonomy...'}</p>}
      {unavailableDrafts.length > 0 && <section aria-label="Unavailable taxonomy drafts"><h3>Unavailable entries: retained drafts</h3>{unavailableDrafts.map((draft) => <details key={draft.id}><summary>{draft.name}</summary><p>{draft.sourceLink}</p><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{draft.notes}</pre><button type="button" disabled={Boolean(pending || busyAction)} onClick={() => discardDraft(draft)}>Discard draft</button></details>)}</section>}
      {loadedAt && <section className={parity.views} aria-label="Taxonomy view">
        <span>Show:</span>
        {(['active','archived','all'] as const).map((value) => <button key={value} aria-label={value[0].toUpperCase() + value.slice(1)} aria-pressed={view === value} type="button" onClick={() => setView(value)}>{value[0].toUpperCase() + value.slice(1)}<span>{value === 'active' ? summary.active : value === 'archived' ? summary.archived : summary.total}</span></button>)}
      </section>}
      {loadedAt && <section className={parity.grid}>
        <div className={parity.header} aria-hidden="true" data-taxonomy-columns>{['#',`${label} Name`,'Status','Source Link','Stats','Notes','Actions'].map((column) => <span key={column}>{column}</span>)}</div>
        <div className={styles.taxonomyRows}>
          {visibleRows.length ? visibleRows.map((row, index) => {
            const draft = drafts[row.id] || row;
            const { status: derivedStatus, stats } = relationships.get(row.id)!;
            const changed = draft.name !== row.name || draft.sourceLink !== row.sourceLink || draft.notes !== row.notes;
            return (
              <article className={`${row.archivedAt ? styles.taxonomyRowArchived : styles.taxonomyRow} ${parity.row}`} key={row.id} data-taxonomy-id={row.id} data-status={derivedStatus}>
                <div className={`${styles.taxonomyIndex} ${parity.index}`}>{index + 1}</div>
                <label className={`${styles.taxonomyName} ${parity.field} ${parity.name}`}>
                  <span>{label} Name</span>
                  <input disabled={Boolean(pending || busyAction)} value={draft.name} onChange={(event) => setDraftField(row, 'name', event.target.value)} />
                  {['Winner', 'Mild Winner', 'Scale'].includes(derivedStatus) && <b className={parity.winnerBadge}><span aria-hidden="true">{'\u2B50'}</span> Winner</b>}
                </label>
                <div className={styles.statusStack}>
                  <span className={creativeStatusClass(derivedStatus, styles)}>{derivedStatus}</span>
                  {row.archivedAt ? <span className={styles.inactiveBadge}>Archived</span> : null}
                </div>
                <label className={`${styles.taxonomySource} ${parity.field}`}>
                  <span>Source Link</span>
                  <input disabled={Boolean(pending || busyAction)} value={draft.sourceLink} placeholder="Add link" onChange={(event) => setDraftField(row, 'sourceLink', event.target.value)} />
                  {inspirationLink(draft.sourceLink) && <a className={parity.source} href={inspirationLink(draft.sourceLink)} target="_blank" rel="noopener noreferrer" aria-label={`Open source for ${row.name}`}><ExternalLink size={11}/>Open source</a>}
                </label>
                <div className={`${styles.taxonomyStats} ${parity.stats}`}>
                  <button type="button" aria-label={`View ${oppositeLabel} for ${row.name}`} onClick={() => setSelected({ id: row.id, view: 'relationships' })}><span aria-hidden="true">{kind === 'angle' ? '\u{1F465}' : '\u{1F3AF}'}</span> {stats.relatedCount} {stats.relatedCount === 1 ? oppositeLabel.slice(0, -1) : oppositeLabel}</button>
                  <button type="button" aria-label={`View creatives for ${row.name}`} onClick={() => setSelected({ id: row.id, view: 'creatives' })}><span aria-hidden="true">{'\u{1F3A8}'}</span> {stats.creatives} {stats.creatives === 1 ? 'creative' : 'creatives'}</button>
                  <span><span aria-hidden="true">{'\u{1F3C6}'}</span> {stats.winRate}% win</span>
                </div>
                <label className={`${styles.taxonomyNotes} ${parity.field}`}>
                  <span>Notes</span>
                  <textarea disabled={Boolean(pending || busyAction)} value={draft.notes} placeholder="Add notes..." rows={2} onChange={(event) => setDraftField(row, 'notes', event.target.value)} />
                </label>
                <div className={`${styles.rowActions} ${parity.actions}`}>
                  <button aria-label={busyAction === 'save' && changed ? 'Saving...' : 'Save'} title="Save" disabled={!changed || writesDisabled} type="button" onClick={() => saveRow(row)}><Save size={13}/></button>
                  <button aria-label={row.archivedAt ? 'Restore' : 'Archive'} title={row.archivedAt ? 'Restore' : 'Archive'} disabled={writesDisabled} type="button" onClick={() => setArchived(row, !row.archivedAt)}>{row.archivedAt ? <RotateCcw size={13}/> : <Archive size={13}/>}</button>
                  <button aria-label="Delete" title="Delete" disabled={writesDisabled} type="button" onClick={() => deleteRow(row)}><Trash2 size={13}/></button>
                  {changed && <button aria-label="Discard draft" title="Discard draft" disabled={writesDisabled} type="button" onClick={() => discardDraft(row)}><Undo2 size={13}/></button>}
                  {changed && draftVersions[row.id] !== undefined && draftVersions[row.id] !== row.updatedAt && <button className={parity.review} disabled={writesDisabled} type="button" onClick={() => reviewDraft(row)}>Review latest version</button>}
                </div>
              </article>
            );
          }) : <div className={styles.emptyState}>No {label.toLowerCase()}s in this view.</div>}
        </div>
      </section>}
      {selected && <TaxonomyRelationships key={`${selected.id}:${selected.view}`} kind={kind} row={rows.find((row) => row.id === selected.id)} relation={relationships.get(selected.id)} initialView={selected.view} error={readError} onClose={() => setSelected(null)} openCreative={openCreative} />}
      {mergeOpen && <TaxonomyMergeDialog kind={kind} rows={rows} creatives={creatives} busy={Boolean(busyAction)} pending={Boolean(pending)} error={error} close={() => setMergeOpen(false)} merge={mergeRows} retry={retry} />}
    </div>
  );
}
