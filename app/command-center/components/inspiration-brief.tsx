'use client';
import { useRef, useState } from 'react';
import { FileSearch } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Inspiration } from '../hooks/use-inspiration-library';
import { requestQaClickUp } from '../services/qa-clickup';
import { saveInspirationBrief } from '../../../lib/services/inspiration-brief.js';
import { clickUpDocumentUrl } from '../../../lib/domain/inspiration-context.js';
import { inspirationText, inspirationVoice } from '../../../lib/domain/inspiration-library.js';
import styles from '../inspiration.module.css';

function valueText(value:unknown):string {
  if(typeof value==='string')return inspirationText(value);
  if(typeof value==='number')return String(value);
  if(Array.isArray(value))return value.map(valueText).filter(Boolean).join('\n');
  if(value && typeof value==='object')return Object.entries(value).map(([key,item])=>`${key.replaceAll('_',' ')}: ${valueText(item)}`).join('\n');
  return '';
}
function Breakdown({rows}:{rows:unknown}) {
  if(!Array.isArray(rows) || !rows.length)return null;
  const items=rows.filter((row)=>row && typeof row==='object' && !Array.isArray(row));
  const columns=[...new Set(items.flatMap((row)=>Object.keys(row)))];
  return <div className={styles.briefTable} role="region" aria-label="Script breakdown" tabIndex={0}><table><thead><tr>{columns.map((key)=><th key={key}>{key.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{items.map((row,index)=><tr key={index}>{columns.map((key)=><td key={key}>{key.includes('voice')?inspirationVoice(valueText(row[key])):valueText(row[key])}</td>)}</tr>)}</tbody></table></div>;
}
export function InspirationStoredBrief({brief}:{brief:Record<string,any>}) {
  return <section><h3>Stored classification brief</h3>
    <Breakdown rows={brief.frame_by_frame}/>
    {['why_it_works','replication_brief','what_to_test','competitor_intel','our_next_ad','inspiration_script_skeleton'].map((key)=>brief[key]?<details key={key}><summary>{key.replaceAll('_',' ')}</summary><p className={styles.prose}>{valueText(brief[key])}</p></details>:null)}
    {Array.isArray(brief.next_ad_scripts)?brief.next_ad_scripts.filter((script:any)=>script && typeof script==='object').map((script:any,index:number)=><details key={index}><summary>{valueText(script.variation) || `Variation ${index+1}`}</summary>
      <dl className={styles.facts}>{['intent','hook_text','source_format_match','voice_over_script','cta','what_to_change','why_it_should_work'].map((key)=><div key={key}><dt>{key.replaceAll('_',' ')}</dt><dd className={styles.prose}>{key==='voice_over_script'?inspirationVoice(valueText(script[key])):valueText(script[key])}</dd></div>)}</dl><Breakdown rows={script.script_breakdown}/></details>):null}
  </section>;
}
export function InspirationBriefLookup({db,productId,row,run}:{db:SupabaseClient;productId:string;row:Inspiration;run:(op:()=>Promise<unknown>)=>Promise<unknown>}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false);
  const pending=useRef<Record<string,unknown>|null>(null),lock=useRef(false);
  async function lookup() {
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try {
      await run(async()=>{
        try {
          if(!pending.current) {
            const found=await requestQaClickUp(db,productId,{operation:'inspiration-brief',inspirationId:row.id,expectedUpdatedAt:row.version});
            if(found.productId!==productId || found.inspirationId!==row.id || found.version!==row.version || !clickUpDocumentUrl(found.url))throw Object.assign(new Error('Brief lookup could not be verified.'),{definite:true});
            pending.current={p_product_id:productId,p_request_id:crypto.randomUUID(),p_id:row.id,p_expected_updated_at:row.version,p_url:found.url};
          }
          await saveInspirationBrief(db,pending.current);
          pending.current=null;setUncertain(false);
        }catch(cause){if((cause as {definite?:boolean}).definite)pending.current=null;setUncertain(!!pending.current);setError(cause instanceof Error?cause.message:'Brief lookup failed.');}
      });
    }catch(cause){setError(cause instanceof Error?cause.message:'Brief lookup failed.');}
    finally{lock.current=false;setBusy(false);}
  }
  // Keep the same receipt retry available even when a lost response's realtime update supplies the link.
  if(row.briefUrl && !pending.current)return null;
  return <section><h3>Remote brief</h3><p>No verified remote brief link has been saved{row.editFields._classificationBrief?'; the stored brief is available below.':'.'}</p>
    {error?<p role="alert" className={styles.error}>{error}</p>:null}
    <div className={styles.commands}><button type="button" disabled={busy || row.queueOnly || !row.version} onClick={()=>void lookup()}><FileSearch size={15}/>{busy?'Finding brief...':uncertain?'Retry same brief save':'Fetch and save brief'}</button></div>
  </section>;
}
