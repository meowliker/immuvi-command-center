'use client';
import { useId, useState } from 'react';
import { RefreshCw, X, ArrowUpRight } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkerRow } from '../types';
import { useModalDialog } from '../hooks/use-modal-dialog';
import { PrivateWorkerControls } from './private-worker-controls';
import { InspirationPriority } from './inspiration-priority';
import { activityEstimate, type inspirationActivity } from '../../../lib/domain/inspiration-activity.js';
import { formatAge, formatDateTime } from '../helpers/format';
import shared from '../../command-center.module.css';
import styles from '../inspiration.module.css';

type Job=ReturnType<typeof inspirationActivity>[number];
export function InspirationActivityPanel({db,workerAdminId,mode,setMode,close,workers,imageOnline,imageKnown,jobs,errors,loaded,busy,refresh,inspect,inspectableIds,now,classifierWorkers}:{
  db:SupabaseClient;workerAdminId?:string;mode:'workers'|'activity';setMode:(mode:'workers'|'activity')=>void;close:()=>void;
  workers:WorkerRow[];imageOnline:boolean;imageKnown:boolean;jobs:Job[];errors:string[];loaded:boolean;busy:boolean;refresh:()=>void;
  inspect:(id:string)=>void;inspectableIds:string[];now:number;classifierWorkers:string[];
}) {
  const ref=useModalDialog({onClose:close,panelSelector:'[data-modal-panel]'}),title=useId();
  const [filter,setFilter]=useState('all');
  const ongoing=jobs.filter(job=>['pending','running','blocked'].includes(job.status));
  const visible=ongoing.filter(job=>filter==='all' || job.status===filter);
  return <dialog ref={ref} className={shared.planDrawer} aria-labelledby={title} onCancel={event=>{event.preventDefault();close();}}>
    <aside data-modal-panel className={`${shared.planDrawerPanel} ${styles.activityPanel}`}>
      <header className={shared.planDrawerHeader}>
        <div className={shared.planDrawerSource}><span>Active product</span><button autoFocus type="button" aria-label="Close worker panel" onClick={close}><X size={16}/></button></div>
        <h2 id={title}>Workers and activity</h2>
        <div className={shared.planDrawerActions}>
          <button type="button" aria-pressed={mode==='workers'} onClick={()=>setMode('workers')}>Workers</button>
          <button type="button" aria-pressed={mode==='activity'} onClick={()=>setMode('activity')}>Tasks</button>
          <button type="button" aria-label="Refresh worker activity" title="Refresh" disabled={busy} onClick={refresh}><RefreshCw size={15}/></button>
        </div>
      </header>
      <div className={styles.activityBody}>
        {errors.length?<p role="alert" className={styles.error}>{errors.join('. ')}. Counts may be incomplete; previously loaded tasks are retained.</p>:null}
        {!loaded && !errors.length?<p role="status">Loading worker activity...</p>:null}
        {mode==='workers'?<>
          <PrivateWorkerControls db={db}/>
        </>:<>
          <div className={styles.activitySummary}><span>{jobs.filter(job=>job.status==='running').length} running</span><span>{jobs.filter(job=>job.status==='pending').length} queued</span><span>{jobs.filter(job=>job.status==='blocked').length} blocked</span></div>
          <label className={styles.activityFilter}>Status<select aria-label="Queue status" value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">In progress</option><option value="pending">Queued</option><option value="running">Running</option><option value="blocked">Blocked</option></select></label>
          {visible.map(job=>{
            const estimate=activityEstimate(job,jobs,{classifierWorkers,imageOnline,now});
            const since=job.startedAt || job.queuedAt;
            return <article className={styles.activityItem} data-activity-id={job.id} key={job.id}>
              <header><span>{job.kind}</span><span className={styles.badge} data-state={job.status}>{job.status}</span></header>
              <h3>{job.title}</h3>{job.title!==job.target?<small>{job.target}</small>:null}
              {job.status==='pending' && job.privateJobId?<InspirationPriority db={db} jobId={job.privateJobId} refresh={refresh}/>:null}
              <dl><div><dt>Stage</dt><dd>{job.stage}</dd></div><div><dt>Estimated remaining</dt><dd title={estimate.basis}>{estimate.text}</dd></div><div><dt>Worker</dt><dd>{job.worker || 'Unassigned'}</dd></div><div><dt>{job.startedAt?'Elapsed':'Waiting'}</dt><dd>{since?formatAge(Math.max(0,(job.finishedAt || now)-since)):'Unknown'}</dd></div><div><dt>Queued</dt><dd>{job.queuedAt?formatDateTime(new Date(job.queuedAt).toISOString()):'Unknown'}</dd></div></dl>
              {estimate.basis?<p className={styles.activityNote}>{estimate.basis}</p>:null}
              {job.brief?<p>{job.brief}</p>:null}{job.error?<p className={styles.error}>{job.error}</p>:null}
              {job.kind==='Inspiration' && inspectableIds.includes(job.target)?<div className={styles.commands}><button type="button" aria-label={`Inspect inspiration ${job.target}`} onClick={()=>inspect(job.target)}><ArrowUpRight size={14}/>Inspect</button></div>:null}
            </article>;
          })}
          {loaded && !visible.length?<p role="status">{errors.length?'No tasks available from the sources that loaded.':filter==='all'?'No ongoing or queued tasks.':'No tasks match this filter.'}</p>:null}
        </>}
      </div>
    </aside>
  </dialog>;
}
