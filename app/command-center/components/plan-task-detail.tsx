'use client';
import { useState, type ReactNode } from 'react';
import { ArrowRight, ExternalLink, RotateCcw, Trash2 } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActionRecord } from '../types';
import type { useActionPlan } from '../hooks/use-action-plan';
import type { usePlanDeletion } from '../hooks/use-plan-deletion';
import type { usePlanRecreation } from '../hooks/use-plan-recreation';
import type { PlanVisibility } from '../hooks/use-plan-visibility';
import type { PlanCheckpointControl } from '../hooks/use-plan-checkpoint';
import { planPresentation } from '../../../lib/domain/action-plan-presentation.js';
import { explicitPlanSource } from '../../../lib/domain/action-plan-editing.js';
import { formatDateTime } from '../helpers/format';
import { creationLocked } from '../services/plan-workflow';
import { PlanTaskDrawer } from './plan-task-drawer';
import { PlanTitleEditor } from './plan-title-editor';
import { PlanAgeBadge, type PlanAge } from './plan-age-badge';
import { PlanAnomalyBadges } from './plan-anomaly-badges';
import { PlanVisibilityButton } from './plan-visibility-button';
import { PlanHistory } from './plan-history';
import { PlanPushControl } from './plan-push-control';
import { PlanWinningArtifacts } from './plan-winning-artifacts';
import { PlanFieldControl } from './plan-field-control';
import { PlanCreativeEditor } from './plan-creative-dialog';
import styles from '../../command-center.module.css';

export function PlanTaskDetail({ action, plan, db, productId, age, review, deletion, repair, visibility, now, feedback, openMatrix }: {
  action: ActionRecord; plan: ReturnType<typeof useActionPlan>; db: SupabaseClient; productId: string; age?: PlanAge;
  review: PlanCheckpointControl; deletion: ReturnType<typeof usePlanDeletion>; repair: ReturnType<typeof usePlanRecreation>;
  visibility: PlanVisibility; now: number; feedback: ReactNode; openMatrix: (angle: string, persona: string) => void;
}) {
  const [mode, setMode] = useState<'buyer' | 'strategist'>('buyer');
  const [artifactBusy, setArtifactBusy] = useState(false);
  const [creativeOpen, setCreativeOpen] = useState(false);
  const d = action.display, detail = planPresentation(action, plan.ageAds, plan.inspirations);
  const job = plan.creationJobs.find((item) => item.ad_id === d.linkedAdId);
  const busy = !!plan.busyAction || visibility.busy || repair.busy || deletion.busy || artifactBusy;
  const locked = busy || creationLocked(job);
  const editLocked = plan.editingBusy || visibility.busy || repair.busy || deletion.busy || artifactBusy || creationLocked(job);
  const linked = !!d.linkedAdId;
  const toolbar = <>
    <div className={styles.planDrawerActions}>
      {creationLocked(job) && linked ? <PlanPushControl name={d.title} linked={false} job={job} busy={busy} onPush={(id) => void plan.pushToClickUp(action, id)} />
        : d.clickupTaskDeleted ? (repair.available(action) ? <button type="button" disabled={locked} onClick={() => repair.open(action)}><RotateCcw size={14} />Repair ClickUp link</button> : <span>ClickUp task deleted</span>)
        : detail.clickupUrl ? <a href={detail.clickupUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />Open ClickUp</a>
          : linked ? <PlanPushControl name={d.title} linked={false} job={job} busy={busy} onPush={(id) => void plan.pushToClickUp(action, id)} /> : null}
      {d.angle && d.persona ? <button type="button" disabled={editLocked} onClick={() => openMatrix(d.angle, d.persona)}><ArrowRight size={14} />Open in Matrix</button> : null}
      {!d.isVirtual ? <button type="button" title="Remove from Action Plan" aria-label="Remove from Action Plan" disabled={locked} onClick={() => plan.removeFromPlan(action)}><Trash2 size={14} />Remove</button> : null}
    </div>
    <div className={styles.planDrawerModes} role="group" aria-label="Task detail view">
      <button type="button" disabled={editLocked} aria-pressed={mode === 'buyer'} onClick={() => setMode('buyer')}>Media Buyer</button>
      <button type="button" disabled={editLocked} aria-pressed={mode === 'strategist'} onClick={() => setMode('strategist')}>Strategist</button>
    </div>
  </>;
  return <PlanTaskDrawer action={action} busy={editLocked} close={() => plan.setSelectedActionId('')} toolbar={toolbar}
    age={<PlanAgeBadge age={age} action={action} review={review} disabled={locked} />}>
    {feedback}
    <PlanAnomalyBadges action={action} now={now} />
    <PlanVisibilityButton action={action} visibility={visibility} disabled={locked} />
    {mode === 'buyer' ? <>
      <section><span className={styles.eyebrow}>Decision</span>
        {age?.state === 'red' ? <p className={styles.planDecisionWarning}>Past threshold: {age.label} in {d.status}. Needs a decision.</p> : null}
        <label><span>Status</span><select disabled={editLocked || plan.statusUnavailable(action)} value={d.status} onChange={(event) => plan.updateStatus(action, event.target.value)}>
          {plan.statusOptions(action).map((status) => <option key={status} value={status}>{status}</option>)}
        </select></label>
      </section>
      {detail.winner && linked ? <section><span className={styles.eyebrow}>Winning Artifact</span>
        <PlanWinningArtifacts key={d.linkedAdId} db={db} productId={productId} adId={d.linkedAdId} disabled={locked || explicitPlanSource(action) !== d.linkedAdId} onBusy={setArtifactBusy} />
      </section> : null}
      <section><span className={styles.eyebrow}>Assignments</span>
        <dl><div><dt>Editor</dt><dd><PlanFieldControl name="Editor" action={action} plan={plan} disabled={editLocked} detail /></dd></div>
          <div><dt>Reviewer</dt><dd><PlanFieldControl name="Reviewer" action={action} plan={plan} disabled={editLocked} detail /></dd></div>
          <div><dt>Approved date</dt><dd>{detail.approvedDate || '-'}</dd></div>
          <div><dt>Hook type</dt><dd>{detail.hookType || '-'}</dd></div>
          <div><dt>Created</dt><dd>{formatDateTime(d.createdAt) || '-'}</dd></div></dl>
        <label><span>Due date</span><input disabled={editLocked} type="date" value={d.dueDate || ''} onChange={(event) => plan.updateDueDate(action, event.target.value)} /></label>
      </section>
    </> : <>
      <section><span className={styles.eyebrow}>Brief</span><dl>
        <div><dt>Hook type</dt><dd>{detail.hookType || '-'}</dd></div>
        <div><dt>Creative structure</dt><dd>{detail.creativeStructure || '-'}</dd></div>
        <div><dt>Production style</dt><dd>{detail.productionStyle || '-'}</dd></div>
        <div><dt>Funnel</dt><dd>{d.funnelStage || '-'}</dd></div>
      </dl>{d.description && d.description !== detail.notes ? <p className={styles.planProse}>{d.description}</p> : null}</section>
      {detail.hypothesis || detail.usp ? <section><span className={styles.eyebrow}>Hypothesis &amp; USP</span>
        <dl className={styles.planProseFacts}>{detail.usp ? <div><dt>USP</dt><dd>{detail.usp}</dd></div> : null}
          {detail.hypothesis ? <div><dt>Hypothesis</dt><dd>{detail.hypothesis}</dd></div> : null}</dl></section> : null}
      {detail.notes ? <section><span className={styles.eyebrow}>Notes</span><p className={styles.planProse}>{detail.notes}</p></section> : null}
      <section><span className={styles.eyebrow}>Provenance</span><dl>
        <div><dt>{detail.source.label}</dt><dd>{detail.sourceUrl ? <a href={detail.sourceUrl} target="_blank" rel="noreferrer">{d.source.label || d.source.kind}</a> : d.source.label || d.source.kind}</dd></div>
        <div><dt>ClickUp</dt><dd>{d.clickupTaskId || '-'}</dd></div>
        <div><dt>Cell</dt><dd>{[d.angle, d.persona].filter(Boolean).join(' x ') || '-'}</dd></div>
      </dl></section>
    </>}
    <section><span className={styles.eyebrow}>Cell Identity</span>
      <PlanTitleEditor action={action} busy={editLocked} save={plan.saveCreative} />
      <dl><div><dt>Angle</dt><dd>{d.angle || '-'}</dd></div><div><dt>Persona</dt><dd>{d.persona || '-'}</dd></div>
        <div><dt>Type</dt><dd>{d.adType || '-'}</dd></div><div><dt>Creative</dt><dd>{d.linkedAdId || '-'}</dd></div></dl>
      {linked ? <details onToggle={event => setCreativeOpen(event.currentTarget.open)}><summary>Creative details</summary>
        {creativeOpen ? <PlanCreativeEditor db={db} productId={productId} action={action} busy={editLocked} save={plan.saveCreative} /> : null}
      </details> : null}
    </section>
    {linked ? <section><div className={styles.planNameLine}><span className={styles.eyebrow}>ClickUp Fields</span>
      <button type="button" className={styles.planFieldsButton} aria-label="Refresh ClickUp fields" title="Refresh ClickUp fields" disabled={locked || !plan.fieldSchema || plan.fieldSchema.loading} onClick={plan.fieldSchema?.reload}><RotateCcw size={14} /></button></div>
      {plan.fieldSchema?.error ? <p role="status">{plan.fieldSchema.error} <button type="button" onClick={plan.fieldSchema.reload}>Retry fields</button></p> : null}
      <dl className={styles.planDetailFields}>{plan.fieldSchema?.schema?.fields.filter(field => !['editor', 'reviewer'].includes(field.name.toLowerCase())).map(field => <div key={field.id}>
        <dt>{field.name}</dt><dd><PlanFieldControl name={field.name} action={action} plan={plan} disabled={editLocked} detail /></dd>
      </div>)}</dl>
    </section> : null}
    <section><span className={styles.eyebrow}>Links</span>
      {!d.clickupTaskDeleted && repair.available(action) ? <button type="button" disabled={locked} onClick={() => repair.open(action)}><RotateCcw size={14} />Repair ClickUp link</button> : null}
      <div className={styles.actionLinks}>
      {detail.clickupUrl ? <a href={detail.clickupUrl} target="_blank" rel="noreferrer">ClickUp task</a> : null}
      {detail.adUrl ? <a href={detail.adUrl} target="_blank" rel="noreferrer">Open ad</a> : null}
      {detail.driveUrl ? <a href={detail.driveUrl} target="_blank" rel="noreferrer">Open Drive</a> : null}
      {detail.briefUrl ? <a href={detail.briefUrl} target="_blank" rel="noreferrer">Brief</a> : null}
      {detail.refUrl ? <a href={detail.refUrl} target="_blank" rel="noreferrer">Ref Task</a> : null}
      {detail.sourceUrl ? <a href={detail.sourceUrl} target="_blank" rel="noreferrer">From: {d.source.label}</a> : null}
      {!detail.adUrl && !detail.driveUrl && !detail.briefUrl && !detail.sourceUrl && !detail.refUrl ? <span>No reference links</span> : null}
    </div></section>
    <PlanHistory key={JSON.stringify([productId, d.dbId, d.clickupTaskId, d.linkedAdId, explicitPlanSource(action)])}
      db={db} productId={productId} payload={action.payload} target={{ actionId: d.isVirtual ? '' : d.dbId, taskId: d.clickupTaskId,
        adId: explicitPlanSource(action) === d.linkedAdId ? d.linkedAdId : '' }} />
    {deletion.available(action) ? <button className={styles.dangerButton} disabled={locked} type="button" onClick={() => deletion.open(action)}><Trash2 size={16} />Delete creative</button> : null}
  </PlanTaskDrawer>;
}
