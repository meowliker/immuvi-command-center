import { productClickUpListId } from '../../../lib/domain/product-config.js';
import styles from '../../command-center.module.css';
import { FilterSelect } from '../components/filter-select';
import { defaultTrackerFilters, useCreativeTracker } from '../hooks/use-creative-tracker';
import type { Product, TrackerFilters } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ArrowUp, Plus } from 'lucide-react';
import { QA_CLICKUP_LIST_ID } from '../../../lib/domain/clickup-sync.js';
import { useClickUpControls } from '../components/clickup-provider';
import { useTrackerPushAll } from '../hooks/use-tracker-push-all';
import { TrackerTable } from '../components/tracker-table';
import { TrackerDialog } from '../components/tracker-dialog';
import { TrackerEditor } from '../components/tracker-editor';
import { TrackerSpawn } from '../components/tracker-spawn';
import { TrackerWinners } from '../components/tracker-winners';
import { TrackerDelete } from '../components/tracker-delete';
import { useEffect, useState } from 'react';
import { isCreativeTrackerVisible } from '../../../lib/domain/creative-tracker.js';

export function CreativeTrackerTab({ supabase, activeProductId, activeProduct,target,consumeTarget }: { supabase: SupabaseClient; activeProductId: string; activeProduct?: Product;target?:string|null;consumeTarget?:()=>void }) {
  const [navigationError,setNavigationError]=useState('');
  const {
    busy,
    reload,
    error,
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
    actions,
    taxonomy,
  } = useCreativeTracker({ supabase, activeProductId, activeProduct });
  const connection = useClickUpControls();
  const push = useTrackerPushAll(supabase, activeProduct, creatives);
  const pushBlocked = !activeProduct || productClickUpListId(activeProduct) !== QA_CLICKUP_LIST_ID
    ? 'Connect this product to the QA ClickUp test list first.'
    : !connection?.token ? 'Enter a ClickUp key in the QA connection controls first.'
    : !loadedAt || error ? 'Tracker data must finish loading successfully before pushing.' : '';
  useEffect(()=>{
    if(!target || !loadedAt || error)return;
    const matches=creatives.filter((ad)=>ad.id===target && ad.productId===activeProductId && isCreativeTrackerVisible(ad));
    if(matches.length===1){setFilters({...defaultTrackerFilters});actions.open('edit',matches[0]);}
    else setNavigationError('The related creative is missing, deleted, or unavailable in this product.');
    consumeTarget?.();
  },[target,loadedAt,error,creatives,activeProductId,setFilters,actions,consumeTarget]);

  return (
    <div className={styles.trackerWorkspace}>
      <header className={styles.trackerToolbar}>
        <h2>Creative Tracker</h2>
        {push.busy && <button type="button" onClick={push.stop}>Stop push</button>}
        <button title={pushBlocked || 'Push all six classification fields for linked creatives in this product'} disabled={Boolean(pushBlocked) || busy || !!actions.busyAction || push.busy || !!connection?.busy} type="button" onClick={() => void push.pushAll()}><ArrowUp size={13} />{push.busy ? 'Pushing...' : 'Push All to ClickUp'}</button>
        <button className={styles.trackerAddButton} aria-label="Add creative" type="button" disabled={!activeProductId || !!actions.busyAction || push.busy} onClick={() => actions.open('edit', null)}><Plus size={14} />Add Creative</button>
      </header>
      {error ? <div role="alert" className={styles.error}>{error} <button type="button" disabled={busy || push.busy} onClick={reload}>Retry loading</button></div> : null}
      {push.error && <p role="alert" className={styles.error}>{push.error}</p>}
      {push.notice && <p role="status" className={`${styles.notice} ${push.results.some((item) => item.error) ? styles.trackerPushWarning : ''}`}>{push.notice}</p>}
      {push.results.length > 0 && <details className={styles.trackerPushResults}><summary>Push results ({push.results.length})</summary><ul>{push.results.map((item) => <li key={item.id}><strong>{item.title}</strong>: {item.pushed} fields updated{item.error ? `. ${item.error}` : ''}</li>)}</ul></details>}
      {navigationError?<p role="alert" className={styles.error}>{navigationError}</p>:null}
      {actions.notice ? <p role="status" className={styles.notice}>{actions.notice}</p> : null}
      <section className={styles.trackerFilters}>
        <div className={styles.segmented}>
          <button className={filters.taskType === '' ? styles.segmentActive : ''} type="button" onClick={() => setFilter('taskType', '')}>All</button>
          <button className={filters.taskType === 'format' ? styles.segmentActive : ''} type="button" onClick={() => setFilter('taskType', 'format')}>Formats</button>
          <button className={filters.taskType === 'production' ? styles.segmentActive : ''} type="button" onClick={() => setFilter('taskType', 'production')}>Production</button>
        </div>
        <FilterSelect label="All angles" value={filters.angle} values={options.angles} onChange={(value) => setFilter('angle', value)} />
        <FilterSelect label="All personas" value={filters.persona} values={options.personas} onChange={(value) => setFilter('persona', value)} />
        <FilterSelect label="All formats" value={filters.format} values={options.formats} onChange={(value) => setFilter('format', value)} />
        <FilterSelect label="All structures" value={filters.structure} values={options.structures} onChange={(value) => setFilter('structure', value)} />
        <FilterSelect label="All hooks" value={filters.hookType} values={options.hookTypes} onChange={(value) => setFilter('hookType', value)} />
        <FilterSelect label="All production" value={filters.productionStyle} values={options.productionStyles} onChange={(value) => setFilter('productionStyle', value)} />
        <FilterSelect label="All ad types" value={filters.adType} values={options.adTypes} onChange={(value) => setFilter('adType', value)} />
        <FilterSelect label="All funnels" value={filters.funnelStage} values={options.funnelStages} onChange={(value) => setFilter('funnelStage', value)} />
        <FilterSelect label="All statuses" value={filters.status} values={options.statuses} onChange={(value) => setFilter('status', value)} />
        <select aria-label="Creative date range" value={filters.dateRange} onChange={(event) => setFilter('dateRange', event.target.value as TrackerFilters['dateRange'])}>
          <option value="">All time</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
        <button type="button" onClick={() => setFilters({ ...defaultTrackerFilters })}>Clear</button>
      </section>
      <section className={styles.trackerInventory} aria-label="Creative inventory">
          <TrackerTable rows={filtered} creatives={creatives} cells={matrixCells} taxonomy={taxonomy} busy={!!actions.busyAction || push.busy} actions={actions} sort={sort} onSort={setSort} />
      </section>
      {actions.editor ? <TrackerDialog title={actions.editor.kind === 'edit' ? actions.editor.creative ? 'Edit creative' : 'Add creative' : actions.editor.kind === 'spawn' ? 'Create variations or funnel expansion' : actions.editor.kind === 'delete' ? 'Delete creative' : 'Winning files'}
        busy={!!actions.busyAction} onClose={() => actions.setEditor(null)} error={error}>
        {actions.notice ? <p role="status" className={styles.notice}>{actions.notice}</p> : null}
        {actions.editor.kind === 'edit' ? <TrackerEditor creative={actions.editor.creative} taxonomy={taxonomy} schema={actions.schema} loadSchema={actions.loadSchema} save={actions.save} busy={!!actions.busyAction} /> : null}
        {actions.editor.kind === 'spawn' && actions.editor.creative ? <TrackerSpawn creative={actions.editor.creative} creatives={creatives} busy={!!actions.busyAction} spawn={actions.spawn} schema={actions.schema} loadSchema={actions.loadSchema} /> : null}
        {actions.editor.kind === 'winners' && actions.editor.creative ? <TrackerWinners db={supabase} creative={actions.editor.creative} busy={!!actions.busyAction} save={actions.winner} share={actions.shareWinner} /> : null}
        {actions.editor.kind === 'delete' && actions.editor.creative ? <TrackerDelete creative={actions.editor.creative} busy={!!actions.busyAction} remove={actions.remove} /> : null}
      </TrackerDialog> : null}
    </div>
  );
}
