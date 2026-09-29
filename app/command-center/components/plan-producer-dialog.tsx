import { useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Download, Palette, LoaderCircle, RotateCcw } from 'lucide-react';
import { TrackerDialog } from './tracker-dialog';
import { IMAGE_BUCKET,producerSuggestions,imageWorkerOnline,canQueueImageWorker } from '../../../lib/domain/image-producer.js';
import { qaClickUpToken } from '../services/qa-clickup';
import type { Product } from '../types';
import type { useActionPlan } from '../hooks/use-action-plan';
import type { useImageProducer } from '../hooks/use-image-producer';
import styles from '../../command-center.module.css';

type Ad = ReturnType<typeof useActionPlan>['ageAds'][number];
export function PlanProducerDialog({db,product,ad,ads,producer,close}:{db:SupabaseClient;product:Product;ad:Ad;ads:Ad[];producer:ReturnType<typeof useImageProducer>;close:()=>void}){
  const defaults=(product.config?.production||{}) as Record<string,string>;
  const [options,setOptions]=useState({count:5,instruction:'',referenceUrl:String(ad.adLink||''),referenceIds:[] as string[],offer:defaults.offer||'',market:defaults.market||'',productName:defaults.product_name||product.name,forbiddenAliases:defaults.forbidden_aliases||''});
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[selectedRun,setSelectedRun]=useState('');
  const [urls,setUrls]=useState<Record<string,string>>({});
  const requestId=useRef(crypto.randomUUID());
  const [workerId,setWorkerId]=useState('');
  const workers=producer.workers || [];
  const worker=workerId?workers.find(w=>w.id===workerId):workers.find(w=>w.scope!=='shared');
  const eligible=canQueueImageWorker(worker);
  const runs=producer.runs.filter(r=>r.ad_id===ad.id),latest=runs[0];
  const active=latest&&['pending','running'].includes(latest.status);
  const viewed=runs.find(r=>r.id===selectedRun)||latest;
  const suggestions: (Ad & { reasons: string[]; why: string })[]=useMemo(()=>producerSuggestions(ads,ad,producer.memory),[ads,ad,producer.memory]);
  useEffect(()=>{
    let cancelled=false;
    setUrls({});
    if(viewed?.status==='done')void(async()=>{
      const results:Record<string,string>={};
      for(const output of viewed.outputs){
        const signed=await db.storage.from(IMAGE_BUCKET).createSignedUrl(output.path,3600);
        if(signed.error){if(!cancelled)setError('Could not open a generated image. Close and reopen to retry.');continue;}
        results[output.path]=signed.data.signedUrl;
      }
      if(!cancelled)setUrls(results);
    })();
    return()=>{cancelled=true;};
  },[db,viewed?.id,viewed?.status]);
  async function generate(event:React.SyntheticEvent,recoveryId?:string){
    event.preventDefault();if(busy||active||!eligible)return;
    setBusy(true);setError('');
    try{
      let result;
      if(worker?.scope==='shared') {
        const session=await db.auth.getSession();
        if(session.error || !session.data.session)throw new Error('Sign in to QA first.');
        const token=qaClickUpToken(session.data.session.user.id);
        if(!token)throw new Error('Enter your ClickUp key first.');
        const response=await fetch('/api/workers/images',{method:'POST',headers:{Authorization:`Bearer ${session.data.session.access_token}`,'X-ClickUp-Token':token,'Content-Type':'application/json'},
          body:JSON.stringify({requestId:requestId.current,recoveryId,productId:product.id,adId:ad.id,options,workerId:worker.id})});
        const body=await response.json();
        if(!response.ok || body.error)throw new Error(body.error || 'Could not queue shared Producer.');
        if(body.id!==(recoveryId||requestId.current) || !['pending','running','done'].includes(body.status))throw new Error('Producer acknowledgment could not be verified.');
        result={data:body,error:null};
      } else result=await db.rpc('qa_generate_images',{p_request_id:requestId.current,p_product_id:product.id,p_ad_id:ad.id,p_options:options});
      if(result.error)throw result.error;
      requestId.current=crypto.randomUUID();setSelectedRun(result.data.id);producer.reload();
    }catch(err){setError(err instanceof Error?err.message:(err as {message?:string})?.message||'Generation could not be queued.');}
    finally{setBusy(false);}
  }
  return <TrackerDialog title="Generate Ad Images" subtitle={<small>{ad.formatName}</small>} onClose={close} busy={busy} error={error||producer.error} className={styles.producerDialog}>
    <form onSubmit={generate} className={styles.producerForm}>
      <div className={styles.producerColumns}>
      <div className={styles.producerColumn} data-producer-column="brief">
      <section><h3>Strategist suggests</h3>
        {suggestions.length?suggestions.map(ref=><label className={styles.producerSuggestion} key={ref.id}>
          <input type="checkbox" disabled={busy||active} checked={options.referenceIds.includes(ref.id)} onChange={e=>setOptions({...options,referenceIds:e.target.checked?[...options.referenceIds,ref.id]:options.referenceIds.filter(id=>id!==ref.id)})}/>
          <span><strong>{ref.productionStyle||ref.creativeStructure||ref.formatName}</strong><small>{ref.angle} / {ref.persona}</small>{ref.reasons.length?<small>{ref.reasons.join(' · ')}</small>:null}{ref.why?<small>{ref.why}</small>:null}</span><small>{ref.status}</small>
        </label>):<p className={styles.producerMuted}>No proven winner formats for this product yet.</p>}
      </section>
      <label>Own reference image URL<input type="url" placeholder="https://" value={options.referenceUrl} disabled={busy||active} onChange={e=>setOptions({...options,referenceUrl:e.target.value})}/></label>
      <label>Instruction<textarea rows={3} value={options.instruction} disabled={busy||active} maxLength={6000} onChange={e=>setOptions({...options,instruction:e.target.value})}/></label>
      </div>
      <div className={styles.producerColumn} data-producer-column="settings">
      <fieldset disabled={busy||active}><legend>Product defaults</legend>
        {([['productName','Canonical product name'],['offer','Offer'],['market','Market / talent'],['forbiddenAliases','Forbidden aliases']] as const).map(([key,label])=><label key={key}>{label}<input value={options[key]} required={key==='productName'} maxLength={6000} onChange={e=>setOptions({...options,[key]:e.target.value})}/></label>)}
      </fieldset>
      <div className={styles.producerSettings}><label>Images<input type="number" min={1} max={10} step={1} required value={options.count} disabled={busy||active} onChange={e=>setOptions({...options,count:Number(e.target.value)})}/></label><label>Run on worker<select aria-label="Run on worker" value={worker?.id||''} disabled={busy||active} onChange={e=>{setWorkerId(e.target.value);requestId.current=crypto.randomUUID();}}><option value="" disabled>Select worker</option>{workers.map(w=><option key={w.id} value={w.id} disabled={!w.enabled || w.scope==='shared' && w.image_protocol!==1}>{w.name}</option>)}</select></label></div>
      <div className={styles.producerDestination}><span data-online={imageWorkerOnline(worker)}>{imageWorkerOnline(worker)?'Worker online':eligible?'Waiting for worker':'Worker unavailable'}</span><span>{worker?.scope==='shared'?'QA storage + ClickUp':'QA Supabase storage'}</span></div>
      </div>
      </div>
      {active?<p role="status"><LoaderCircle size={14}/> {latest.status==='pending'?'Queued':'Generating images'}...</p>:null}
      <footer><button type="button" disabled={busy} onClick={close}>Close</button><button type="submit" disabled={busy||active||!eligible}><Palette size={15}/>{busy?'Queueing...':'Generate'}</button></footer>
    </form>
    {runs.length?<section className={styles.producerResults} aria-label="Generated images"><h3>Image runs</h3>
      <select aria-label="Image run" value={viewed?.id||''} onChange={e=>setSelectedRun(e.target.value)}>{runs.map(run=><option key={run.id} value={run.id}>{new Date(run.created_at).toLocaleString()} - {run.status}</option>)}</select>
      {viewed?.error?<p role="alert">{viewed.error}</p>:null}
      {viewed?.status==='failed' && worker?.scope==='shared' && viewed.private_worker_id===worker.id
        ?<button type="button" disabled={busy||active||!eligible} onClick={event=>void generate(event,viewed.id)}><RotateCcw size={14}/> Resume saved run</button>:null}
      <div className={styles.producerImages}>{viewed?.outputs.map(output=><figure key={output.path}>
        {urls[output.path]?<a href={urls[output.path]} target="_blank" rel="noreferrer"><img src={urls[output.path]} alt={`${ad.formatName} - ${output.filename}`} width={output.width} height={output.height}/></a>:<span>Loading image...</span>}
        <figcaption>{output.filename} {urls[output.path]?<a href={urls[output.path]} target="_blank" rel="noreferrer" aria-label={`Open ${output.filename}`}><Download size={14}/></a>:null}</figcaption>
        <details><summary>Generation details</summary><p>{output.prompt}</p><ul>{output.quality_checks.map(check=><li key={check}>{check}</li>)}</ul></details>
      </figure>)}</div>
    </section>:null}
  </TrackerDialog>;
}
