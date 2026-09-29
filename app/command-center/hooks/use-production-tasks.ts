'use client';
import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActionRecord } from '../types';
import type { useProduction } from './use-production';
import { canEditPlanTitle, explicitPlanSource } from '../../../lib/domain/action-plan-editing.js';
import { editProduction } from '../../../lib/services/production.js';
import { savePlanBatch } from '../../../lib/services/action-plan-bulk.js';
import { requestQaClickUp } from '../services/qa-clickup';
import { pushPlanCreative } from '../services/plan-workflow';

export function useProductionTasks(db: SupabaseClient,productId: string,board: ReturnType<typeof useProduction>) {
  const [editor,setEditor]=useState<{kind:'details'|'fields'|'remove';action:ActionRecord}|null>(null);
  const [creating,setCreating]=useState(false);
  const [busy,setBusy]=useState(false);
  function available(action:ActionRecord) { return canEditPlanTitle(action) && !board.locked(action); }
  function requireAvailable(action:ActionRecord) {
    if(action.display.productId!==productId || !board.actions.some((row)=>row.display.dbId===action.display.dbId) || !available(action))throw new Error('Task is unavailable or its ClickUp creation needs recovery.');
  }
  function open(kind:'details'|'fields'|'remove',action:ActionRecord) {
    board.setError('');
    if(!available(action))return;
    if(kind!=='remove' && (!action.display.linkedAdId || explicitPlanSource(action)!==action.display.linkedAdId))return;
    setEditor({kind,action});
  }
  async function run(operation:()=>Promise<unknown>) {
    await board.mutate(async()=>{setBusy(true);board.setError('');board.setNotice('');try{await operation();}finally{setBusy(false);}})();
  }
  async function pushPending(action:ActionRecord) {
    const result=await requestQaClickUp(db,productId,{operation:'push-creative',adId:action.display.linkedAdId,actionId:action.display.dbId});
    if(!Number.isInteger(result.pushed) || !Array.isArray(result.failed))throw new Error('ClickUp update could not be verified.');
    return result.failed.length ? `Saved in QA. ClickUp fields pending: ${result.failed.map((f:{field:string;error:string})=>`${f.field}: ${f.error}`).join('; ')}` : 'Task saved in QA and sent to ClickUp.';
  }
  async function save(action:ActionRecord,kind:'details'|'fields'|'format',values:Record<string,unknown>,push:boolean) {
    let success=false;
    await run(async()=>{
      requireAvailable(action);
      const result=await editProduction(db,productId,action,kind,values);
      board.commitSaved(result);setEditor(null);success=true;board.setNotice('Task saved in QA.');
      if(push && action.display.clickupTaskId && Object.keys(values).length) {
        try{board.setNotice(await pushPending(action));}
        catch(cause){board.setNotice(`Saved in QA. ClickUp changes remain pending: ${cause instanceof Error?cause.message:'Request failed.'}`);}
      }
    });
    return success;
  }
  async function remove() {
    if(!editor || editor.kind!=='remove')return;
    await run(async()=>{
      const action=editor.action;requireAvailable(action);
      const saved=await savePlanBatch(db,productId,[action],'remove');
      if(saved[0]?.id!==action.display.dbId || saved[0]?.removed!==true)throw new Error('Removal could not be verified. Refresh before retrying.');
      setEditor(null);board.setNotice('Task removed from Production and Action Plan. Its creative and ClickUp task were preserved.');
    });
  }
  async function push(action:ActionRecord,recoveryTaskId?:string) {
    await run(async()=>{
      if(action.display.productId!==productId || explicitPlanSource(action)!==action.display.linkedAdId || !board.actions.some((row)=>row.display.dbId===action.display.dbId))throw new Error('Task source is unresolved.');
      board.setNotice(await pushPlanCreative(db,productId,action.display.linkedAdId,recoveryTaskId,action.display.dbId));
    });
  }
  async function sync(action:ActionRecord) { await run(async()=>{requireAvailable(action);board.setNotice(await pushPending(action));}); }
  return {editor,creating,setCreating,busy,available,open,close:()=>{if(!busy)setEditor(null);},run,remove,push,sync,
    saveDetails:(action:ActionRecord,values:Record<string,unknown>,push:boolean)=>save(action,'details',values,push),
    saveFormat:(action:ActionRecord,format:string)=>save(action,'format',{format},false),
    saveFields:(action:ActionRecord,values:Record<string,unknown>,push:boolean)=>save(action,'fields',values,push)};
}
