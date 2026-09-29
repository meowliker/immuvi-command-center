'use client';
import { useEffect,useRef,useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { productionDraft,productionRequest } from '../../../lib/domain/production-creation.js';
import { createProduction } from '../../../lib/services/production.js';
import { readProductRows } from '../../../lib/services/product-rows.js';
import { AD_TYPES,FUNNEL_STAGES } from '../../../lib/domain/tracker-editing.js';
import { PRODUCTION_FORMATS } from '../../../lib/domain/production.js';
import { TrackerDialog } from './tracker-dialog';
import styles from '../../command-center.module.css';

export function ProductionCreateDialog({db,productId,run,close,done}:{db:SupabaseClient;productId:string;run:(fn:()=>Promise<unknown>)=>Promise<unknown>;close:()=>void;done:()=>void}) {
  const [draft,setDraft]=useState<Record<string,string>>(productionDraft);
  const [request,setRequest]=useState<ReturnType<typeof productionRequest>|null>(null);
  const [taxonomy,setTaxonomy]=useState<{angles:string[];personas:string[]}>({angles:[],personas:[]});
  const [key,setKey]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);
  const lock=useRef(false);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError('');
    void (async()=>{
      const [session,angles,personas]=await Promise.all([db.auth.getSession(),readProductRows(db,'angles',productId,controller.signal),readProductRows(db,'personas',productId,controller.signal)]);
      if(session.error || !session.data.session)throw new Error('Sign in to QA first.');
      const storageKey=`immuvi:qa:production:${session.data.session.user.id}:${productId}`;
      const raw=sessionStorage.getItem(storageKey);
      if(controller.signal.aborted)return;
      if(raw){const saved=JSON.parse(raw);const expected=productionRequest(productId,saved.draft,saved.request?.p_request_id);
        if(JSON.stringify(expected)!==JSON.stringify(saved.request))throw new Error('Saved creation request is invalid. Contact your admin before creating another task.');
        setDraft(saved.draft);setRequest(expected);
      }
      setTaxonomy({angles:angles.filter((row)=>!row.archived_at).map((row)=>row.name),personas:personas.filter((row)=>!row.archived_at).map((row)=>row.name)});setKey(storageKey);
    })().catch((cause)=>{if(!controller.signal.aborted)setError(cause.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[db,productId,attempt]);
  async function save() {
    if(lock.current || !key)return;lock.current=true;setBusy(true);setError('');
    try {
      const pending=request || productionRequest(productId,draft,crypto.randomUUID());
      // Persist before sending; reload must recover this request rather than create a second task.
      sessionStorage.setItem(key,JSON.stringify({request:pending,draft}));setRequest(pending);
      await run(async()=>{
        try{await createProduction(db,pending);sessionStorage.removeItem(key);done();}
        catch(cause){if((cause as {definite?:boolean}).definite){sessionStorage.removeItem(key);setRequest(null);}setError(cause instanceof Error?cause.message:'Creation could not be verified. Retry this same request.');}
      });
    }catch(cause){setError(cause instanceof Error?cause.message:'Could not save draft.');}
    finally{lock.current=false;setBusy(false);}
  }
  const enums:Record<string,string[]>={format:PRODUCTION_FORMATS,angle:taxonomy.angles,persona:taxonomy.personas,adType:AD_TYPES,funnelStage:FUNNEL_STAGES};
  const labels:Record<string,string>={formatName:'Task name',format:'Format',angle:'Angle',persona:'Persona',adType:'Ad type',funnelStage:'Funnel stage',adLink:'Inspiration link',driveLink:'Drive link',dueDate:'Due date',creativeHypothesis:'Creative hypothesis',notes:'Notes'};
  return <TrackerDialog title="Add production task" busy={busy} error={error} onClose={close}>
    {loading?<p role="status">Loading task form...</p>:<form onSubmit={(event)=>{event.preventDefault();void save();}}>
      <fieldset className={styles.trackerForm} disabled={busy || !!request || !key}><div className={styles.trackerFormGrid}>
        {Object.entries(labels).map(([field,label])=><label key={field} className={['formatName','notes','creativeHypothesis'].includes(field)?styles.trackerWide:undefined}>{label}
          {enums[field]?<select aria-label={label} value={draft[field] || ''} onChange={(e)=>setDraft({...draft,[field]:e.target.value})}><option value="">Not set</option>{[...new Set([...enums[field],draft[field]])].filter(Boolean).map((value)=><option key={value}>{value}</option>)}</select>
            :['notes','creativeHypothesis'].includes(field)?<textarea aria-label={label} value={draft[field]} onChange={(e)=>setDraft({...draft,[field]:e.target.value})}/>
              :<input required={field==='formatName'} maxLength={field==='formatName'?500:4000} type={field==='dueDate'?'date':field.endsWith('Link')?'url':'text'} value={draft[field]} onChange={(e)=>setDraft({...draft,[field]:e.target.value})}/>}</label>)}
      </div></fieldset>
      {request?<p role="status">Creation is awaiting confirmation. Retry uses the same request.</p>:null}
      {!key?<button type="button" onClick={()=>setAttempt((value)=>value+1)}>Retry loading form</button>:null}
      <footer><button type="button" disabled={busy} onClick={close}>Cancel</button><button type="submit" disabled={busy || !key}>{request?'Recover same creation':'Create task'}</button></footer>
    </form>}
  </TrackerDialog>;
}
