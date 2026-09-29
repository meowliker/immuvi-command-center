import { summarizeActionPlan } from '../../../lib/domain/action-plan.js';
import { productClickUpListId } from '../../../lib/domain/product-config.js';
import styles from '../../command-center.module.css';
import { formatDateTime } from '../helpers/format';
import { useActionPlan } from '../hooks/use-action-plan';
import { PlanSyncNotice } from '../components/plan-sync-notice';
import type { ActionRecord, Product } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';
import { filterPlanActions, PLAN_FILTERS, sortPlanActions } from '../../../lib/domain/action-plan-workspace.js';
import { PlanToolbar, type PlanFilters, type PlanLayout } from '../components/plan-toolbar';
import { PlanPipeline } from '../components/plan-pipeline';
import { PlanWeek } from '../components/plan-week';
import { PlanTrends } from '../components/plan-trends';
import { usePlanClock } from '../hooks/use-plan-clock';
import { PlanTable, type PlanSort } from '../components/plan-table';
import { usePlanViews } from '../hooks/use-plan-views';
import { PlanViewControls } from '../components/plan-view-controls';
import { planViewColumns } from '../../../lib/domain/action-plan-views.js';
import { usePlanAgeOverrides } from '../hooks/use-plan-age-overrides';
import { planHealth } from '../../../lib/domain/action-plan-health.js';
import { RotateCcw } from 'lucide-react';
import { usePlanCheckpoint } from '../hooks/use-plan-checkpoint';
import { PlanCheckpointDialog } from '../components/plan-checkpoint-dialog';
import { usePlanLinkedDone } from '../hooks/use-plan-linked-done';
import { PlanPulse } from '../components/plan-pulse';
import { PlanHistory } from '../components/plan-history';
import { planAnomalies } from '../../../lib/domain/action-plan-filters.js';
import { usePlanVisibility } from '../hooks/use-plan-visibility';
import { planHiddenCount } from '../../../lib/domain/action-plan-visibility.js';
import { usePlanDeletion } from '../hooks/use-plan-deletion';
import { PlanDeleteDialog, PlanDeletedCreatives } from '../components/plan-deletion';
import { usePlanRecreation } from '../hooks/use-plan-recreation';
import { PlanRecreationDialog } from '../components/plan-recreation-dialog';
import { PlanLayoutControls } from '../components/plan-layout-controls';
import { PlanVariations } from '../components/plan-variations';
import { PlanTaskDetail } from '../components/plan-task-detail';
import { PlanCards } from '../components/plan-cards';
import { PlanVariationDialog } from '../components/plan-variation-dialog';
import { VariationBreakdown } from '../components/variation-breakdown';
import { planVariationGroups } from '../../../lib/domain/action-plan-variations.js';
import { canSpawnVariations } from '../../../lib/domain/variation-lab.js';
import { creationLocked } from '../services/plan-workflow';
import { GitBranch, Palette, Globe2 } from 'lucide-react';
import { useImageProducer } from '../hooks/use-image-producer';
import { PlanProducerDialog } from '../components/plan-producer-dialog';

export function ActionPlanTab({ supabase, activeProductId, activeProduct, openMatrix }: { supabase: SupabaseClient; activeProductId: string; activeProduct?: Product; openMatrix: (angle: string, persona: string) => void }) {
  const plan = useActionPlan({ supabase, activeProductId, activeProduct });
  const producer = useImageProducer(supabase, activeProductId);
  const [producerAdId,setProducerAdId] = useState('');
  useEffect(()=>setProducerAdId(''),[activeProductId]);
  const producerAd = plan.ageAds.find(ad=>ad.id===producerAdId&&ad.productId===activeProductId&&!ad.deletedAt);
  function producerControl(action: ActionRecord) {
    const adId=action.display.linkedAdId;
    const run=producer.runs.find(item=>item.ad_id===adId);
    return <button type="button" className={styles.producerButton} data-status={run?.status||'idle'} title="Generate ad images" aria-label={`Generate images for ${action.display.title}`} disabled={!adId||!!plan.busyAction} onClick={()=>setProducerAdId(adId)}><Palette size={15}/>{run? <small>{run.status}</small>:null}</button>;
  }
  const deletion = usePlanDeletion(supabase, activeProductId, plan);
  const repair = usePlanRecreation(supabase, activeProductId, plan);
  const views = usePlanViews(supabase);
  const visibility = usePlanVisibility(supabase, activeProductId);
  const columns = planViewColumns(views.state.views.find((item) => item.id === views.state.activeViewId), plan.actions, plan.fieldSchema?.schema?.fields);
  const [filters, setFilters] = useState<PlanFilters>({ ...PLAN_FILTERS });
  const [sort, setSort] = useState<PlanSort>({ key: 'updatedAt', direction: -1 });
  const [view, setView] = useState<PlanLayout>('table');
  const [variationParent, setVariationParent] = useState('');
  const [variationNotice, setVariationNotice] = useState('');
  const variationGroups = useMemo(() => new Map(planVariationGroups(plan.ageAds, plan.actions, activeProductId, visibility.hiddenIds).map((group) => [group.id, group])), [plan.ageAds, plan.actions, activeProductId, visibility.hiddenIds]);
  function variationControl(action: ActionRecord) {
    const id = action.display.linkedAdId;
    const parent = plan.ageAds.find((ad) => ad.id === id && ad.productId === activeProductId);
    const eligible = visibility.ready && !visibility.hiddenIds.has(id) && canSpawnVariations(parent);
    const disabled = !!plan.busyAction || creationLocked(plan.creationJobs.find((job) => job.ad_id === id));
    return variationGroups.has(id) ? <VariationBreakdown group={variationGroups.get(id)} busy={disabled} spawn={eligible ? () => setVariationParent(id) : undefined}
      open={(_, actionId) => { if (actionId) plan.setSelectedActionId(actionId); }} /> : eligible ? <button type="button" title="Create variations" aria-label={`Spawn from ${action.display.title}`} disabled={disabled} onClick={() => setVariationParent(id)}><GitBranch size={15} /></button> : null;
  }
  const now = usePlanClock();
  const statusRules = plan.statusRules;
  const ageOverrides = usePlanAgeOverrides(activeProductId);
  const linkedDone = usePlanLinkedDone(supabase, activeProductId, productClickUpListId(activeProduct), plan.actions, now);
  const health = useMemo(() => planHealth(plan.actions, plan.ageAds, now, statusRules.statuses, ageOverrides, linkedDone.dates), [plan.actions, plan.ageAds, now, statusRules.statuses, ageOverrides, linkedDone.dates]);
  const summary = useMemo(() => summarizeActionPlan(health.actions.map((action) => action.display), now), [health.actions, now]);
  const review = usePlanCheckpoint(supabase, activeProductId, plan, health.ages);
  const anomalyCount = useMemo(() => health.actions.filter((action) => planAnomalies(action, now).length > 0).length, [health.actions, now]);
  const {
    busy,
    reload,
    notice,
    error,
    loadedAt,
    filter,
    setFilter,
    selectedAction: inspectedAction,
    busyAction,
    setSelectedActionId,
  } = plan;
  const filtered = useMemo(() => {
    if (!visibility.ready) return [];
    const matching: ActionRecord[] = filterPlanActions(health.actions, { ...filters, bucket: filter }, now, health.ages, visibility.hiddenIds);
    // Selection narrows eligible rows; it never bypasses other filters or hiding.
    const selected = new Set(plan.bulk.selectedIds);
    const rows = plan.bulk.selectedOnly && view !== 'week' && view !== 'trends'
      ? matching.filter((action) => selected.has(action.display.dbId)) : matching;
    return sortPlanActions(rows, sort.key, sort.direction, health.ages);
  }, [health.actions, filters, filter, sort, now, health.ages, visibility.ready, visibility.hiddenIds, plan.bulk.selectedIds, plan.bulk.selectedOnly, view]);
  const selectedAction = visibility.ready && (filters.showHidden || !visibility.hiddenIds.has(inspectedAction?.display.linkedAdId || '')) ? inspectedAction : null;
  useEffect(() => {
    // A later restore in another tab must not unexpectedly reopen a dismissed drawer.
    if (visibility.ready && !filters.showHidden && inspectedAction && visibility.hiddenIds.has(inspectedAction.display.linkedAdId)) setSelectedActionId('');
  }, [visibility.ready, visibility.hiddenIds, filters.showHidden, inspectedAction, setSelectedActionId]);
  const hiddenCount = planHiddenCount(health.actions, visibility.hiddenIds);
  const feedback = <>
    {variationNotice ? <div className={styles.notice} role="status">{variationNotice}</div> : null}
    {!error && notice ? <PlanSyncNotice key={notice} message={notice} /> : null}
    {review.notice ? <div className={styles.notice} role="status">{review.notice}</div> : null}
    {deletion.notice ? <div className={styles.notice} role="status">{deletion.notice}</div> : null}
    {repair.notice ? <div className={styles.notice} role="status">{repair.notice}</div> : null}
    {error ? <PlanSyncNotice key={error} message={error} error /> : null}
    {visibility.error ? <div className={styles.error} role="alert">{visibility.error} <button type="button" disabled={visibility.busy} onClick={visibility.reload}>Retry hidden tasks</button></div> : null}
  </>;

  return (
    <>
      {!selectedAction || view === 'trends' ? feedback : null}
      {!visibility.ready && !visibility.error ? <p role="status">Loading hidden-task preferences...</p> : null}
      {view !== 'trends' && view !== 'variations' && loadedAt ? <PlanPulse actions={health.actions} filters={filters} change={setFilters} now={now} /> : null}
      <header className={styles.planViewHeader}>
        <PlanLayoutControls view={view} change={setView} />
        <div className={styles.planHeaderSummary} role="group" aria-label="Action Plan summary">
          {loadedAt ? <>
            <span title="All eligible saved and adopted tasks in backlog"><strong data-plan-summary="backlog">{summary.backlog}</strong> Backlog</span>
            <span title="All eligible saved and adopted tasks in production"><strong data-plan-summary="production">{summary.production}</strong> Production</span>
            <span title="All eligible saved and adopted overdue tasks" data-overdue={summary.overdue > 0}><strong data-plan-summary="overdue">{summary.overdue}</strong> Overdue</span>
          </> : <span role="status">{error ? 'Counts unavailable' : 'Loading counts...'}</span>}
          <button type="button" aria-label={busy ? 'Refreshing...' : 'Refresh'} title={`Refresh tasks. Loaded ${formatDateTime(loadedAt)}. ClickUp list: ${productClickUpListId(activeProduct) || 'Not linked'}`}
            disabled={busy || !!busyAction} onClick={reload}><RotateCcw size={15} /></button>
        </div>
      </header>
      <PlanToolbar db={supabase} productId={activeProductId} listStatuses={statusRules.statuses} actions={health.actions} visible={filtered} filters={filters} setFilters={setFilters} resetFilters={() => { setFilters({ ...PLAN_FILTERS }); setFilter('all'); plan.bulk.setSelectedOnly(false); }} view={view} bucket={filter} setBucket={setFilter} bulk={plan.bulk} busy={!!busyAction || visibility.busy}>
      <div className={styles.planAttention}>
        {view !== 'trends' ? <button type="button" className={styles.planAllWork} aria-label="Include all work" aria-pressed={filters.includeAdopted}
          title={`${plan.actions.filter((action) => !action.display.isVirtual).length} app tasks, ${plan.actions.filter((action) => action.display.isVirtual).length} adopted creatives`}
          onClick={() => setFilters({ ...filters, includeAdopted: !filters.includeAdopted })}><Globe2 size={14} />{filters.includeAdopted ? 'All work' : 'App-only'} <strong data-adopted-total>{plan.actions.filter((action) => filters.includeAdopted || !action.display.isVirtual).length}</strong></button> : null}
        {view !== 'trends' ? <label title="Reveal tasks hidden from your plan without changing anyone else's plan"><input type="checkbox" aria-label="Show hidden tasks" disabled={!visibility.ready} checked={filters.showHidden} onChange={(e) => setFilters({ ...filters, showHidden: e.target.checked })} />Show hidden <strong data-hidden-total>{hiddenCount}</strong></label> : null}
        {view !== 'trends' ? <label title="Deleted ClickUp tasks, removed production tags, and recent re-links"><input type="checkbox" aria-label="Anomalies only" checked={filters.anomaliesOnly} onChange={(e) => setFilters({ ...filters, anomaliesOnly: e.target.checked })} />Anomalies <strong data-anomaly-total>{anomalyCount}</strong></label> : null}
        {view !== 'trends' ? <label title={[...health.groups].map(([status, count]) => `${count} ${status}`).join(', ')}><input type="checkbox" aria-label="Needs attention only" checked={filters.attentionOnly} onChange={(e) => setFilters({ ...filters, attentionOnly: e.target.checked })} />Needs attention <strong data-attention-total>{health.total}</strong></label> : null}
      </div>
      {view === 'table' ? <PlanViewControls views={views} actions={plan.actions} fields={plan.fieldSchema?.schema?.fields} loaded={!!loadedAt && !!plan.fieldSchema && !plan.fieldSchema.loading} /> : null}
      </PlanToolbar>
      <div className={styles.planStatusNotes}>
        {!plan.fieldSchema ? <span role="status">Refresh the app to load field editing. <button type="button" onClick={() => window.location.reload()}>Refresh app</button></span> : null}
        {plan.fieldSchema?.error ? <span role="status">Field editing unavailable. {plan.fieldSchema.error} <button type="button" onClick={plan.fieldSchema.reload}>Retry fields</button></span> : null}
        {plan.fieldSchema?.loading ? <span role="status">Loading ClickUp fields...</span> : null}
        {statusRules.error ? <span role="status">Using default status rules. ClickUp status rules unavailable.</span> : null}
        {statusRules.loading ? <span role="status">Loading status rules...</span> : null}
        {statusRules.error && view !== 'pipeline' ? <button type="button" aria-label="Retry status rules" title="Retry status rules" onClick={statusRules.reload}><RotateCcw size={16} /></button> : null}
        {linkedDone.loading ? <span role="status">Loading production completion dates...</span> : null}
        {linkedDone.error ? <span role="status">Using fallback timestamps. {linkedDone.error}</span> : null}
        {linkedDone.count > 0 ? <button type="button" aria-label="Refresh production completion dates" title="Refresh production completion dates" disabled={linkedDone.loading} onClick={linkedDone.reload}><RotateCcw size={16} /></button> : null}
      </div>
      <section className={styles.planWorkspace}>
        <section className={styles.planTaskPanel}>
          <h2 className={styles.srOnly}>Action Plan{view === 'variations' ? ': Variations' : `: ${view === 'trends' ? plan.actions.length : filtered.length} tasks`}</h2>
          {view === 'pipeline' ? <PlanPipeline listId={productClickUpListId(activeProduct)} actions={filtered} allActions={health.actions} statusRules={statusRules} ages={health.ages} review={review} now={now} visibility={visibility}
            selectedIds={plan.bulk.selectedIds} busy={!!busyAction} select={plan.bulk.select} open={(id) => { setView('table'); setSelectedActionId(id); }} />
            : view === 'week' ? <PlanWeek actions={filtered} now={now} />
            : view === 'trends' ? <PlanTrends actions={health.actions} now={now} stuck={health.total} />
            : view === 'variations' ? <PlanVariations ads={plan.ageAds} actions={plan.actions} productId={activeProductId} hiddenIds={visibility.hiddenIds}
              loaded={!!loadedAt && visibility.ready} error={error || visibility.error} open={setSelectedActionId} spawn={setVariationParent} busy={!!busyAction} />
            : view === 'table' ? <PlanTable key={views.state.activeViewId} rows={filtered} plan={plan} sort={sort} setSort={setSort} columns={columns} resizeColumn={(key, width) => views.resizeColumn(columns, key, width)} resizingDisabled={!views.ready || views.busy} ages={health.ages} review={review} now={now} visibility={visibility} variationControl={variationControl} producerControl={producerControl} deletion={deletion} repair={repair} /> : <PlanCards rows={filtered} plan={plan} repair={repair} ages={health.ages} review={review} visibility={visibility} now={now} variationControl={variationControl} />}
        </section>
        {selectedAction && view !== 'trends' ? <PlanTaskDetail key={plan.presentationKeys.get(selectedAction.display.dbId)}
          action={selectedAction} plan={plan} db={supabase} productId={activeProductId} age={health.ages.get(selectedAction.display.dbId)}
          review={review} deletion={deletion} repair={repair} visibility={visibility} now={now} feedback={feedback} openMatrix={openMatrix} /> : null}
        {view === 'cards' ? <section className={styles.planCardsSummary} aria-label="Cards summary">
          <div className={styles.actionSummary}>
            <div><strong>{summary.total}</strong><span>Cards</span></div>
            <div><strong>{summary.testing}</strong><span>Testing</span></div>
            <div><strong>{summary.winners}</strong><span>Winners</span></div>
            <div><strong>{summary.losers}</strong><span>Losers</span></div>
          </div>
          <PlanHistory key={activeProductId} db={supabase} productId={activeProductId} />
        </section> : null}
      </section>
      <PlanDeletedCreatives rows={plan.deletedCreatives} deletion={deletion} busy={!!busyAction || deletion.busy} />
      {producerAd&&activeProduct?<PlanProducerDialog key={`${activeProductId}:${producerAd.id}`} db={supabase} product={activeProduct} ad={producerAd} ads={plan.ageAds} producer={producer} close={()=>setProducerAdId('')}/>:null}
      {deletion.target ? <PlanDeleteDialog key={deletion.target.adId} deletion={deletion} /> : null}
      {repair.target ? <PlanRecreationDialog key={repair.target.adId} repair={repair} /> : null}
      {review.target ? <PlanCheckpointDialog review={review} /> : null}
      {variationParent ? <PlanVariationDialog key={`${activeProductId}:${variationParent}`} db={supabase} productId={activeProductId} parentId={variationParent} plan={plan}
        close={() => setVariationParent('')} done={(message) => { setVariationNotice(message); setVariationParent(''); }} /> : null}
    </>
  );
}
