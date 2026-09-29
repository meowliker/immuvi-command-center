'use client';
import { useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Inspiration } from '../hooks/use-inspiration-library';
import { requestQaClickUp } from '../services/qa-clickup';
import { TrackerDialog } from './tracker-dialog';
import { QA_CLICKUP_LIST_ID } from '../../../lib/domain/clickup-sync.js';
import styles from '../inspiration.module.css';

export function InspirationSourceSync({db,productId,row,close,done}:{db:SupabaseClient;productId:string;row:Inspiration;close:()=>void;done:(message:string)=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),lock=useRef(false);
  async function sync(){
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try{
      const result=await requestQaClickUp(db,productId,{operation:'sync-inspiration-type',inspirationId:row.id,expectedUpdatedAt:row.version});
      if(!result.synced || result.productId!==productId || result.inspirationId!==row.id || result.version!==row.version || result.taskId!==row.editFields._sourceClickupId || result.adType!==row.editFields.adType)throw new Error('Source-task update could not be confirmed. Refresh before retrying.');
      done('Source ad type verified in the QA ClickUp task.');
    }catch(cause){setError(cause instanceof Error?cause.message:'Source-task sync failed.');}
    finally{lock.current=false;setBusy(false);}
  }
  return <TrackerDialog title="Sync source ad type" busy={busy} error={error} closeLabel="Close source sync" onClose={close}>
    <p><strong>{row.formatName}</strong></p><p>Set source task <strong>{String(row.editFields._sourceClickupId)}</strong> to <strong>{String(row.editFields.adType || '(empty)')}</strong>? Only tasks in QA list {QA_CLICKUP_LIST_ID} can be changed.</p>
    <footer className={styles.editorFooter}><button type="button" disabled={busy} onClick={close}>Cancel</button><button type="button" disabled={busy} onClick={()=>void sync()}>{busy?'Syncing...':'Sync ad type'}</button></footer>
  </TrackerDialog>;
}
