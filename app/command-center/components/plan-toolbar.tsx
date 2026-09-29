import { useState, type ReactNode } from 'react';
import { Search, Upload, X, Square, Trash2, RotateCcw } from 'lucide-react';
import { PlanDateFilter } from './plan-date-filter';
import { PlanFilterChips } from './plan-filter-chips';
import { PlanFacetFilter, type PlanFacetKey } from './plan-facet-filter';
import { PLAN_FACETS, planFacetOptions, togglePlanFacet } from '../../../lib/domain/action-plan-filters.js';
import { PLAN_BATCH_LIMIT, PLAN_FILTERS } from '../../../lib/domain/action-plan-workspace.js';
import { workflowStatuses } from '../helpers/creatives';
import type { ActionFilter, ActionRecord } from '../types';
import type { useActionPlan } from '../hooks/use-action-plan';
import styles from '../../command-center.module.css';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PlanOneScale } from './plan-onescale';

export type PlanFilters = typeof PLAN_FILTERS;
export type PlanLayout = 'table' | 'cards' | 'pipeline' | 'week' | 'trends' | 'variations';
export function PlanToolbar({ actions, visible, filters, setFilters, resetFilters, view, bulk, busy, db, productId, bucket, setBucket, children, listStatuses }: {
  listStatuses?: { status: string }[];
  db: SupabaseClient; productId: string;
  actions: ActionRecord[]; visible: ActionRecord[]; filters: PlanFilters; setFilters: (value: PlanFilters) => void;
  resetFilters: () => void;
  view: PlanLayout; bucket: ActionFilter; setBucket: (value: ActionFilter) => void; children: ReactNode;
  bulk: ReturnType<typeof useActionPlan>['bulk']; busy: boolean;
}) {
  const [status, setStatus] = useState('');
  const [due, setDue] = useState('');
  const overview = view === 'trends' || view === 'variations';
  const bulkView = !overview && view !== 'week';
  const selected = visible.filter((a) => bulk.selectedIds.includes(a.display.dbId));
  const hiddenCount = actions.filter((a) => bulk.selectedIds.includes(a.display.dbId) && !visible.includes(a)).length;
  const disabled = busy || !selected.length || selected.length > PLAN_BATCH_LIMIT;
  const update = (key: 'query' | 'due', value: string) => setFilters({ ...filters, [key]: value });
  const allSelected = visible.length > 0 && selected.length === visible.length;
  const search = <label className={styles.planSearch}><Search size={15} aria-hidden="true" /><input aria-label="Search Action Plan" type="search" placeholder="Search task name" value={filters.query} onChange={(e) => update('query', e.target.value)} /></label>;
  return <>
    {!overview ? <div className={styles.planToolbar} aria-label="Action Plan filters">
      <PlanDateFilter filters={filters} change={setFilters} />
      {(PLAN_FACETS as PlanFacetKey[]).map((key) => <PlanFacetFilter key={key} facet={key} values={filters[key]} options={planFacetOptions(actions, filters[key], key)}
        toggle={(value) => setFilters(togglePlanFacet(filters, key, value))} clear={() => setFilters({ ...filters, [key]: [], ...(key === 'status' ? { pulseKeys: [] } : {}) })} />)}
      <select aria-label="Filter due dates" value={filters.due} onChange={(e) => update('due', e.target.value)}><option value="">All due dates</option><option value="overdue">Overdue</option><option value="none">No due date</option></select>
      <select aria-label="Action Plan task group" value={bucket} onChange={(e) => setBucket(e.target.value as ActionFilter)}>
        <option value="all">All cards</option><option value="backlog">Backlog</option><option value="production">Production</option>
        <option value="testing">Testing</option><option value="winners">Winners</option><option value="losers">Losers</option><option value="overdue">Overdue</option>
      </select>
      <button type="button" title="Reset filters" aria-label="Reset Action Plan filters" onClick={resetFilters}><RotateCcw size={16} /></button>
      {children}
      <output className={styles.planResultCount} aria-label="Filtered tasks" data-plan-result-count>{visible.length} / {actions.length}</output>
    </div> : null}
    {!overview ? <PlanFilterChips filters={filters} change={setFilters} reset={resetFilters} /> : null}
    {view === 'week' ? <div className={styles.planSearchRow}>{search}</div> : null}
    {bulkView ? <div className={styles.planBulkBar} aria-label="Action Plan bulk actions">
      <label><input type="checkbox" aria-label="Select all visible tasks" checked={allSelected} disabled={busy || !visible.length} onChange={(e) => bulk.select(visible.map((a) => a.display.dbId), e.target.checked)} /><span data-plan-selected-count aria-live="polite">{selected.length} selected</span></label>
      {hiddenCount > 0 ? <span>{hiddenCount} hidden selections excluded</span> : null}
      {selected.length > PLAN_BATCH_LIMIT ? <span role="alert">Maximum {PLAN_BATCH_LIMIT} tasks per batch.</span> : null}
      <PlanOneScale key={productId} db={db} productId={productId} selected={selected} busy={busy} />
      {bulk.selectedIds.length > 0 || bulk.running ? <>
      <select aria-label="Bulk status" disabled={busy} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Set status</option>{workflowStatuses('', selected.some(action => action.display.clickupTaskId) ? listStatuses : undefined).map((value) => <option key={value}>{value}</option>)}</select>
      <button type="button" disabled={disabled || !status || !workflowStatuses('', selected.some(action => action.display.clickupTaskId) ? listStatuses : undefined).includes(status)} onClick={() => void bulk.run(selected, 'status', status)}>Apply status</button>
      <input aria-label="Bulk due date" type="date" disabled={busy} value={due} onChange={(e) => setDue(e.target.value)} />
      <button type="button" disabled={disabled || !due} onClick={() => void bulk.run(selected, 'due', due)}>Apply date</button>
      <button type="button" disabled={disabled} onClick={() => void bulk.run(selected, 'due', '')}>Clear dates</button>
      <button type="button" disabled={disabled} onClick={() => void bulk.run(selected, 'push')}><Upload size={15} />Push selected</button>
      <button type="button" title={selected.some((a) => a.display.isVirtual) ? 'Hide adopted tasks using their eye control' : 'Remove selected from plan'} aria-label="Remove selected from plan" disabled={disabled || selected.some((a) => a.display.isVirtual)} onClick={() => void bulk.run(selected, 'remove')}><Trash2 size={16} /></button>
      </> : null}
      {bulk.selectedIds.length > 0 || bulk.selectedOnly ? <button type="button" title="Clear selection" aria-label="Clear selection" disabled={busy} onClick={bulk.clear}><X size={16} /></button> : null}
      {bulk.running ? <button type="button" disabled={bulk.stopping} onClick={bulk.cancel}><Square size={14} />{bulk.stopping ? 'Stopping after current task' : 'Stop after current task'}</button> : null}
      <label className={styles.planSelectedOnly} data-active={bulk.selectedOnly} title="Show only the tasks currently selected in this list"><input type="checkbox" aria-label="Show Selected" checked={bulk.selectedOnly} disabled={busy} onChange={(e) => bulk.setSelectedOnly(e.target.checked)} />Show Selected</label>
      {search}
    </div> : null}
    {bulk.running && !bulkView ? <div className={styles.planBulkBar}>
      <button type="button" disabled={bulk.stopping} onClick={bulk.cancel}><Square size={14} />{bulk.stopping ? 'Stopping after current task' : 'Stop after current task'}</button>
    </div> : null}
    {bulk.results.length ? <section className={styles.planResults} aria-label="Bulk results" aria-live="polite">
      <strong>{bulk.running ? 'Bulk progress' : 'Bulk results'}</strong>
      <ul>{bulk.results.map((result) => <li key={result.id} data-state={result.state}><strong>{result.title}</strong><span>{result.message}</span></li>)}</ul>
    </section> : null}
  </>;
}
