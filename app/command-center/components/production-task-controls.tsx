import { FilePenLine,Users,Trash2,ListMinus,Upload,RotateCcw } from 'lucide-react';
import type { ActionRecord } from '../types';
import type { useProduction } from '../hooks/use-production';
import type { useProductionTasks } from '../hooks/use-production-tasks';
import type { usePlanDeletion } from '../hooks/use-plan-deletion';
import type { usePlanRecreation } from '../hooks/use-plan-recreation';
import { PlanTitleEditor } from './plan-title-editor';
import { PlanPushControl } from './plan-push-control';
import styles from '../../command-center.module.css';

export function ProductionTaskControls({action,board,tasks,deletion,repair,busy}:{action:ActionRecord;board:ReturnType<typeof useProduction>;tasks:ReturnType<typeof useProductionTasks>;deletion:ReturnType<typeof usePlanDeletion>;repair:ReturnType<typeof usePlanRecreation>;busy:boolean}) {
  const d=action.display,locked=busy || board.locked(action),eligible=tasks.available(action),job=board.creationJobs.find((row)=>row.ad_id===d.linkedAdId);
  return <>
    <div className={styles.trackerButtons}>
      <PlanTitleEditor action={action} busy={locked} save={tasks.saveDetails}/>
      {d.linkedAdId?<>
        <button type="button" disabled={locked || !eligible} title="Edit task details" aria-label={`Edit details for ${d.title}`} onClick={()=>tasks.open('details',action)}><FilePenLine size={15}/></button>
        <button type="button" disabled={locked || !eligible} title="Assignments and fields" aria-label={`Assignments for ${d.title}`} onClick={()=>tasks.open('fields',action)}><Users size={15}/></button>
      </>:null}
      <button type="button" disabled={locked || !eligible} title="Remove from Production and Action Plan" aria-label={`Remove ${d.title} from Production`} onClick={()=>tasks.open('remove',action)}><ListMinus size={15}/></button>
      {deletion.available(action)?<button type="button" disabled={locked} title="Delete creative" aria-label={`Delete creative for ${d.title}`} onClick={()=>deletion.open(action)}><Trash2 size={15}/></button>:null}
      {d.clickupTaskId && !d.clickupTaskDeleted?<button type="button" disabled={locked || !eligible} title="Sync pending ClickUp changes" aria-label={`Sync ClickUp for ${d.title}`} onClick={()=>void tasks.sync(action)}><Upload size={15}/></button>:null}
      {repair.available(action)?<button type="button" disabled={locked} title="Repair ClickUp link" aria-label={`Repair ClickUp link for ${d.title}`} onClick={()=>repair.open(action)}><RotateCcw size={15}/></button>:null}
    </div>
    {d.linkedAdId && (!d.clickupTaskId || board.locked(action))?<PlanPushControl name={d.title} linked={false} busy={busy} job={job} onPush={(id)=>void tasks.push(action,id)}/>:null}
  </>;
}
