'use client';
import { useState, type ReactNode } from 'react';
import { ArrowUpRight, Clapperboard, Lightbulb, Pencil, GitBranch, Star, Unlink, Upload, ListPlus, Trash2, Pin } from 'lucide-react';
import type { Creative } from '../types';
import type { MatrixModel } from '../hooks/use-creative-matrix';
import { trackerDraft, safeCreativeUrl } from '../../../lib/domain/tracker-editing.js';
import { matrixBucket, matrixSource } from '../../../lib/domain/creative-matrix.js';
import { planVariationGroups } from '../../../lib/domain/action-plan-variations.js';
import { canSpawnVariations } from '../../../lib/domain/variation-lab.js';
import { cellColumnValue, cellRelativeDate } from '../helpers/matrix-inspector';
import { workflowStatuses } from '../helpers/creatives';
import { creationLocked } from '../services/plan-workflow';
import { VariationBreakdown } from './variation-breakdown';
import { PlanPushControl } from './plan-push-control';
import styles from '../../command-center.module.css';

export function MatrixInspectorRow({ ad, model:m, columns, group }: { ad:Creative; model:MatrixModel; columns:string[]; group?:ReturnType<typeof planVariationGroups>[number] }) {
  const [name,setName]=useState<string|null>(null);
  const [taxonomy,setTaxonomy]=useState<{ angle:string; persona:string }|null>(null);
  const job=m.creationJobs.find(job => job.ad_id===ad.id);
  const busy=!!m.busyAction, locked=creationLocked(job);
  const draft=taxonomy || { angle:ad.angle,persona:ad.persona };
  const save=(values:Record<string,string>) => m.actions.save(ad,{...trackerDraft(ad),...values},{},true);
  const inspiration=m.inspirations.find(item=>item.id===ad.fromInspoId);
  const sourceCreative=m.creatives.find(item=>item.id===ad.sourceFormatId);
  const inspirationUrl=safeCreativeUrl(inspiration?.url || ad.adLink || sourceCreative?.adLink);
  const source=matrixSource(ad);
  const icon=source==='inspo' ? <Lightbulb size={15} /> : source==='clickup' ? <ArrowUpRight size={15} /> : <Clapperboard size={15} />;
  const sourceName={inspo:'From Inspiration',clickup:'ClickUp',app:'App'}[source];
  const content=(column:string):ReactNode => {
    switch(column) {
      case 'source': return <span className={styles.cellSourceIcon} data-source={source} title={sourceName} aria-label={sourceName}>{icon}</span>;
      case 'name': return <input aria-label={`Task name for ${ad.formatName}`} title={ad.formatName || ad.id} value={name ?? ad.formatName} disabled={busy || locked}
        onChange={e=>setName(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') e.currentTarget.blur(); if(e.key==='Escape') { e.stopPropagation();setName(null); } }}
        onBlur={()=>{ if(name!==null && name.trim() && name.trim()!==ad.formatName) void save({formatName:name.trim()}).then(()=>setName(null)); else setName(null); }} />;
      case 'type': return ad.adType || '-';
      case 'funnel': return ad.funnelStage || '-';
      case 'origin': return ad.adOrigin || '-';
      case 'created': return <span title={ad.createdAt ? new Date(ad.createdAt).toLocaleString() : undefined}>{cellRelativeDate(ad.createdAt)}</span>;
      case 'due': return <input type="date" aria-label={`Matrix due date for ${ad.formatName}`} disabled={busy || locked} value={ad.dueDate} onChange={e=>void save({dueDate:e.target.value})} />;
      case 'status': return <select className={styles.cellStatus} data-status={ad.status} data-bucket={matrixBucket(ad.status)} aria-label={`Matrix status for ${ad.formatName}`} disabled={busy || locked} value={ad.status} onChange={e=>void save({status:e.target.value})}>{workflowStatuses(ad.status).map(status=><option key={status}>{status}</option>)}</select>;
      case 'taxonomy': return <div className={styles.cellTaxonomy}>
        <select aria-label={`Matrix angle for ${ad.formatName}`} title={draft.angle} disabled={busy || locked} value={draft.angle} onChange={e=>setTaxonomy({...draft,angle:e.target.value})}>
          {[...new Set([ad.angle,...m.angles.map(a=>a.name)])].map(value=><option key={value} value={value}>{value || 'Not set'}</option>)}</select>
        <select aria-label={`Matrix persona for ${ad.formatName}`} title={draft.persona} disabled={busy || locked} value={draft.persona} onChange={e=>setTaxonomy({...draft,persona:e.target.value})}>
          {[...new Set([ad.persona,...m.personas.map(p=>p.name)])].map(value=><option key={value} value={value}>{value || 'Not set'}</option>)}</select>
        <button type="button" aria-label={`Save taxonomy for ${ad.formatName}`} disabled={busy || locked || !taxonomy || (draft.angle===ad.angle && draft.persona===ad.persona)} onClick={()=>void save(draft).then(()=>setTaxonomy(null))}>Save</button>
      </div>;
      case 'inspirationTrace': return inspirationUrl ? <a className={styles.cellInspirationLink} href={inspirationUrl} target="_blank" rel="noreferrer" title={inspiration?.name || ad.fromInspoId || 'Inspiration'}><Pin size={13} />{ad.fromInspoId || 'Inspiration'}</a> : ad.fromInspoId ? <span title={inspiration?.name}>{ad.fromInspoId}</span> : '-';
      case 'creativeUSP': return <span className={styles.cellTruncated} title={ad.creativeUSP || ad.creativeHypothesis}>{ad.creativeUSP || ad.creativeHypothesis || '-'}</span>;
      case 'notes': return <span className={styles.cellTruncated} title={ad.notes}>{ad.notes || '-'}</span>;
      case 'action': return <div className={styles.cellActions}>
        <button type="button" disabled={busy || locked} title="Edit creative" aria-label={`Edit ${ad.formatName}`} onClick={()=>m.actions.open('edit',ad)}><Pencil size={14} /></button>
        <button type="button" disabled={busy || m.plannedIds.includes(ad.id)} title={m.plannedIds.includes(ad.id) ? 'Already in Action Plan' : 'Add to Action Plan'} aria-label={`Add ${ad.formatName} to Action Plan`} onClick={()=>void m.stage(ad)}><ListPlus size={14} />{m.plannedIds.includes(ad.id) ? 'In Plan' : 'Plan'}</button>
        {canSpawnVariations(ad) ? <><button type="button" disabled={busy || locked} title="Create variations" aria-label={`Spawn from ${ad.formatName}`} onClick={()=>m.actions.open('spawn',ad)}><GitBranch size={14} /></button>
          <button type="button" disabled={busy} title="Winning files" aria-label={`Winning files for ${ad.formatName}`} onClick={()=>m.actions.open('winners',ad)}><Star size={14} /></button></> : null}
        <VariationBreakdown openCreatives group={group} busy={busy || locked} spawn={canSpawnVariations(ad) ? ()=>m.actions.open('spawn',ad) : undefined} open={id=>{ const child=m.creatives.find(item=>item.id===id);if(child) m.actions.open('edit',child); }} />
        {ad.clickupTaskId && Object.keys(ad.pendingClickUp).length ? <button type="button" disabled={busy} title="Push pending ClickUp updates" aria-label={`Push changes for ${ad.formatName}`} onClick={()=>void m.actions.push(ad)}><Upload size={14} /></button> : null}
        {([['ClickUp',ad._clickupUrl],['Drive',ad.driveLink]] as const).map(([label,url])=>safeCreativeUrl(url) ? <a key={label} href={safeCreativeUrl(url)} target="_blank" rel="noreferrer">{label}<ArrowUpRight size={12} /></a> : null)}
        <button type="button" disabled={busy} title="Remove from cell; keep creative" aria-label={`Remove ${ad.formatName} from cell`} onClick={()=>void m.assignment(ad,false)}><Unlink size={14} /></button>
        <PlanPushControl name={ad.formatName} job={job} linked={!!ad.clickupTaskId} busy={busy} onPush={taskId=>void m.pushPlan(ad,taskId)} />
      </div>;
      case 'delete': return <button type="button" title="Delete creative" aria-label={`Delete ${ad.formatName}`} disabled={busy || locked} onClick={()=>m.actions.open('delete',ad)}><Trash2 size={14} /></button>;
      default: return <span className={styles.cellTruncated} title={String(cellColumnValue(ad,column))}>{cellColumnValue(ad,column) || '-'}</span>;
    }
  };
  return <tr data-cell-creative={ad.id} data-bucket={matrixBucket(ad.status)}>{columns.map(column=><td key={column} data-column={column}>{content(column)}</td>)}</tr>;
}
