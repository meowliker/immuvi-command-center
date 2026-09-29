'use client';
import { useState } from 'react';
import { Upload, RotateCcw, Plus } from 'lucide-react';
import { creationLocked, type CreationJob } from '../services/plan-workflow';
import styles from '../../command-center.module.css';

export function PlanPushControl({ name,job,linked,busy,onPush,compact=false }: {
  name:string; job?:CreationJob; linked:boolean; busy:boolean; onPush:(taskId?:string) => void; compact?:boolean;
}) {
  const [taskId,setTaskId] = useState('');
  if (linked) return null;
  const recover=creationLocked(job);
  return <div className={styles.planPushControl} data-compact={compact}>
    <button type="button" disabled={busy} title={recover ? 'Recover existing ClickUp task' : 'Add to Action Plan and create ClickUp task'}
      aria-label={`${recover ? 'Recover ClickUp link for' : 'Push to ClickUp:'} ${name}`} onClick={() => onPush()}>
      {recover ? <RotateCcw size={compact ? 12 : 16} /> : compact ? <Plus size={12} /> : <Upload size={16} />}{recover ? compact ? 'Recover' : 'Recover ClickUp link' : compact ? 'ClickUp' : 'Push to ClickUp'}
    </button>
    {job?.last_error ? <small role="status">{job.last_error}</small> : recover ? <small>Creation awaiting confirmation</small> : null}
    {recover ? <details><summary>Known task ID</summary><label>ClickUp task ID<input value={taskId} onChange={(e) => setTaskId(e.target.value)} disabled={busy} /></label>
      <button type="button" disabled={busy || !taskId.trim()} onClick={() => onPush(taskId)}><RotateCcw size={16} />Verify and link</button></details> : null}
  </div>;
}
