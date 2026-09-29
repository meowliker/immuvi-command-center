'use client';
import { useState } from 'react';
import { RefreshCw, Pencil, Check, Trash2, RotateCcw, CheckCheck, Download, ListChecks } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '../types';
import { useInspirationLibrary, type Inspiration } from '../hooks/use-inspiration-library';
import { useInspiration } from '../hooks/use-inspiration';
import { InspirationActivityPanel } from '../components/inspiration-activity-panel';
import { useInspirationActivity } from '../hooks/use-inspiration-activity';
import { inspirationActivity } from '../../../lib/domain/inspiration-activity.js';
import { imageWorkerOnline } from '../../../lib/domain/image-producer.js';
import { workerHealth, inspirationWorkerSummary } from '../../../lib/domain/worker-queue.js';
import { InspirationLibrary } from '../components/inspiration-library';
import { InspirationDrawer } from '../components/inspiration-drawer';
import { InspirationEditor } from '../components/inspiration-editor';
import { InspirationActionDialog } from '../components/inspiration-action-dialog';
import { InspirationPlacement } from '../components/inspiration-placement';
import { InspirationCrossImport } from '../components/inspiration-cross-import';
import { InspirationRecovery } from '../components/inspiration-recovery';
import { InspirationBatchImport } from '../components/inspiration-batch-import';
import { InspirationSourceSync } from '../components/inspiration-source-sync';
import { InspirationBriefLookup } from '../components/inspiration-brief';
import { InspirationMapping } from '../components/inspiration-mapping';
import { inspirationDuplicateLinks } from '../../../lib/domain/inspiration-mapping.js';
import { useInspirationContext } from '../hooks/use-inspiration-context';
import { InspirationPulse, InspirationInsights, InspirationTrends } from '../components/inspiration-analytics';
import { usePlanClock } from '../hooks/use-plan-clock';
import { PLAN_FILTERS } from '../../../lib/domain/action-plan-workspace.js';
import { matchesInspirationPulse } from '../../../lib/domain/inspiration-analytics.js';
import { INSPIRATION_FILTERS } from '../../../lib/domain/inspiration-library.js';
import styles from '../inspiration.module.css';
import { PrivateInspirationProcess } from '../components/private-inspiration-process';
import { PrivateInspirationRetry } from '../components/private-inspiration-retry';
import { useWorkspaceNotice } from '../components/workspace-toasts';

export function InspirationTab({ supabase, activeProductId, activeProduct, products,openCreative,workerAdminId }: { supabase: SupabaseClient; activeProductId: string; activeProduct?: Product; products:Product[];openCreative?:(id:string)=>void;workerAdminId?:string }) {
  const [view, setView] = useState('library');
  const library = useInspirationLibrary(supabase, activeProductId);
  const workers = useInspiration({supabase,activeProductId,activeProduct});
  const activity=useInspirationActivity(supabase,activeProductId);
  const [panel,setPanel]=useState<'workers'|'activity'|null>(null);
  const context = useInspirationContext(supabase,activeProductId,products,library.rows);
  const now=usePlanClock();
  const currentWorkers=workers.workers.map(worker=>({...worker,health:workerHealth({status:worker.status,enabled:worker.enabled,last_heartbeat:worker.lastHeartbeat},now)}));
  const classifierWorkers=activity.imageWorkers.filter(worker=>worker.enabled && worker.classifier_available && now-Date.parse(worker.heartbeat_at)<45000).map(worker=>worker.id);
  const imageKnown=activity.loaded && !activity.errors.some(error=>error.includes('Image worker'));
  const imageOnline=imageKnown && activity.imageWorkers.some(worker=>imageWorkerOnline(worker,now));
  const workerSummary=inspirationWorkerSummary(activity.imageWorkers,now);
  const privateBySource=new Map([...activity.privateJobs].reverse().map(job=>[job.inspiration_id,job]));
  const queue=workers.jobs.map(row=>{const job=privateBySource.get(row.insId);return job?{...row,status:job.status,privateJobId:job.can_control===false?undefined:job.id,priority:job.priority,workerAssignment:job.worker_id || 'private',claimedBy:'',errorMessage:job.error||'',queuedAt:job.created_at,processedAt:job.finished_at}:row.workerAssignment==='blocked:qa-isolation'?{...row,status:'blocked',workerAssignment:'private',errorMessage:'Not queued on your private worker. Check your worker and ClickUp connection, then use Process All with Codex.'}:row;});
  const jobs=inspirationActivity({productId:activeProductId,queue,briefs:activity.briefs,images:activity.images,ads:activity.ads,inspirations:library.rows});
  const activityErrors=[...(workers.error?[workers.error]:[]),...activity.errors];
  const counts={running:jobs.filter(job=>job.status==='running').length,queued:jobs.filter(job=>job.status==='pending').length,blocked:jobs.filter(job=>job.status==='blocked').length};
  const loaded=!!workers.loadedAt && activity.loaded;
  const [period,setPeriod]=useState({...PLAN_FILTERS}),[pulseKey,setPulseKey]=useState('');
  const visible=library.visible.filter((row:Inspiration)=>matchesInspirationPulse(row,pulseKey,period,now));
  const [editor,setEditor] = useState<{mode:'url'|'manual'|'edit';row:Inspiration|null}|null>(null);
  const [action,setAction] = useState<{operation:string;row:Inspiration}|null>(null);
  const [notice,setNotice] = useState('');
  useWorkspaceNotice({message:notice,title:'Inspiration',kind:/failed|could not|offline|paused|unavailable|uncertain|not confirmed|remain pending|enter.*key|sign in/i.test(notice)?'error':'success',onDismiss:()=>setNotice('')});
  const [importing,setImporting] = useState(false);
  const [recovering,setRecovering] = useState<Inspiration|null>(null);
  const [batchImport,setBatchImport] = useState(false),[sourceSync,setSourceSync] = useState<Inspiration|null>(null);
  const [mapping,setMapping]=useState<{row:Inspiration;kind:'angle'|'persona';target?:string}|null>(null);
  const map=(row:Inspiration,kind:'angle'|'persona',target?:string)=>setMapping({row,kind,target});
  const done = (message:string) => { setEditor(null);setAction(null);setNotice(message); };
  const run = async (operation:() => Promise<unknown>) => {
    setNotice('');
    let started = false;
    await library.mutate(async () => { started = true; return operation(); })();
    if (!started) throw new Error('Another change is being saved. Please try again.');
    await library.refresh({background:true});
    await activity.refresh();
  };
  return <div className={styles.surface}>
    <InspirationEditor key={activeProductId} compact db={supabase} productId={activeProductId} row={null} mode="url" run={run} close={()=>{}} done={setNotice}>
      <PrivateInspirationProcess db={supabase} productId={activeProductId} workers={activity.imageWorkers} done={(message)=>{setNotice(message);void activity.refresh();}}/>
      <button type="button" disabled={!library.loaded || !!library.error || library.busy} onClick={()=>setBatchImport(true)}><span aria-hidden="true">↓</span> Import Results</button>
      <button type="button" onClick={()=>setEditor({mode:'manual',row:null})}>+ Manual</button>
      <button type="button" disabled={!library.loaded || !!library.error} onClick={()=>setImporting(true)}><span aria-hidden="true">🔄</span> Other Products</button>
    </InspirationEditor>
    <div className={styles.workerBar}>
      <button type="button" aria-label="Queue and worker health" onClick={()=>setPanel('workers')} title="Workers"><i data-online={imageKnown && workerSummary.count>0}/>{!imageKnown?'Checking worker...':workerSummary.label}</button>
      <button type="button" className={styles.activityTrigger} aria-label="Open task activity" onClick={()=>setPanel('activity')}><ListChecks size={14}/>{activityErrors.length?'Activity · counts unavailable':!loaded?'Activity · loading...':counts.running || counts.queued || counts.blocked?`${counts.running} running · ${counts.queued} queued${counts.blocked?` · ${counts.blocked} blocked`:''}`:'Activity · idle'}</button>
    </div>
    <>
      <InspirationPulse rows={library.rows} loaded={library.loaded} now={now} period={period} change={(next)=>{setPeriod(next);if(!next.pulseRange)setPulseKey('');}} selected={pulseKey} toggle={(key)=>{setPulseKey((old)=>old===key?'':key);setView('library');}} queue={()=>setPanel('workers')} workerCount={imageKnown?workerSummary.count:null}/>
      <InspirationLibrary showTable={view==='library'} navigation={<div role="group" aria-label="Inspiration view" className={styles.views}>
        {([['library','📋','Table'],['trends','📈','Trends'],['insights','💡','Insights']] as const).map(([key,emoji,label])=><button key={key} type="button" aria-pressed={view===key} onClick={()=>setView(key)}><span aria-hidden="true">{emoji}</span>{label}</button>)}
      </div>} library={{...library,visible}} map={map} context={context} db={supabase} run={run} notice={setNotice} now={now} remove={(row)=>setAction({operation:'delete',row})} clearFilters={()=>{library.setFilters({...INSPIRATION_FILTERS});setPulseKey('');}}/>
      {view==='library'?null:!library.loaded?<p role="status">{library.error?'Inspiration analytics unavailable.':'Loading inspirations...'}</p>:view==='insights'?<InspirationInsights rows={library.rows} now={now} open={library.setSelectedId}/>:<InspirationTrends rows={library.rows} now={now}/>}
    </>
    {panel?<InspirationActivityPanel db={supabase} workerAdminId={workerAdminId} mode={panel} setMode={setPanel} close={()=>setPanel(null)} workers={currentWorkers} imageOnline={imageOnline} imageKnown={imageKnown} jobs={jobs} errors={activityErrors} loaded={loaded} busy={workers.busy || activity.busy} refresh={()=>{void workers.reload();void activity.refresh();}} inspect={(id)=>{setPanel(null);library.setSelectedId(id);}} inspectableIds={library.error?[]:library.rows.map(row=>row.id)} now={now} classifierWorkers={workers.error?[]:classifierWorkers}/>:null}
    {library.selected ? <InspirationDrawer inspiration={library.selected} error={library.error} close={() => library.setSelectedId('')} duplicateLinks={inspirationDuplicateLinks(library.selected,library.creatives)} openCreative={openCreative} context={{loaded:context.loaded,error:context.error,products:[],...context.byId[library.selected.id]}} briefLookup={<InspirationBriefLookup key={`brief:${library.selected.id}`} db={supabase} productId={activeProductId} row={library.selected} run={run}/>} actions={
      !library.selected.queueOnly && library.selected.version ? <>
        <button type="button" onClick={() => setEditor({mode:'edit',row:library.selected})}><Pencil size={14} />Edit</button>
        {(['angle','persona'] as const).map((kind)=><button key={kind} type="button" disabled={!!library.error || library.busy} onClick={()=>map(library.selected!,kind)}>Map {kind}</button>)}
        {library.selected.editFields._sourceClickupId?<button type="button" disabled={!!library.error} onClick={()=>setSourceSync(library.selected)}><RefreshCw size={14}/>Sync source ad type</button>:null}
        {['Failed','Blocked'].includes(library.selected.status)?<PrivateInspirationRetry db={supabase} productId={activeProductId} inspirationId={library.selected.id} done={message=>{setNotice(message);void library.refresh({background:true});void activity.refresh();}}/>:null}
        {[['approve','Approve',Check],['import','Import result',Download],['dismiss_duplicate',library.selected.duplicateReviewed ? 'Reviewed' : 'Review duplicate',CheckCheck],['delete','Delete',Trash2]].map(([operation,label,Icon]) => {
          const Glyph = Icon as typeof Check; return <button type="button" key={String(operation)} disabled={operation === 'dismiss_duplicate' && (!library.selected?.duplicate || library.selected?.duplicateReviewed)} onClick={() => setAction({operation:String(operation),row:library.selected!})}><Glyph size={14} />{String(label)}</button>;
        })}
      </> : library.selected.queueOnly?<button type="button" disabled={!!library.error} onClick={()=>setRecovering(library.selected)}><RotateCcw size={14}/>Recover queue entry</button>:null} placement={<InspirationPlacement key={library.selected.id} db={supabase} productId={activeProductId} row={library.selected} run={run}/>} /> : null}
    {editor ? <InspirationEditor db={supabase} productId={activeProductId} row={editor.row} mode={editor.mode} close={() => setEditor(null)} done={done} run={run} /> : null}
    {action ? <InspirationActionDialog db={supabase} productId={activeProductId} row={action.row} operation={action.operation} close={() => setAction(null)} done={done} run={run} /> : null}
    {importing ? <InspirationCrossImport db={supabase} productId={activeProductId} products={products} destinationRows={library.rows} run={run} close={()=>setImporting(false)} done={(message)=>{setImporting(false);setNotice(message);}}/> : null}
    {recovering?<InspirationRecovery db={supabase} productId={activeProductId} row={recovering} run={run} close={()=>setRecovering(null)} done={(message)=>{setRecovering(null);setNotice(message);}}/>:null}
    {batchImport?<InspirationBatchImport db={supabase} productId={activeProductId} rows={library.rows} run={run} close={()=>setBatchImport(false)}/>:null}
    {sourceSync?<InspirationSourceSync db={supabase} productId={activeProductId} row={sourceSync} close={()=>setSourceSync(null)} done={(message)=>{setSourceSync(null);setNotice(message);}}/>:null}
    {mapping?<InspirationMapping db={supabase} row={mapping.row} kind={mapping.kind} items={library.taxonomyRows[mapping.kind]} creatives={library.creatives} initialTarget={mapping.target} run={run} close={()=>setMapping(null)} done={(message)=>{setMapping(null);setNotice(message);}}/>:null}
  </div>;
}
