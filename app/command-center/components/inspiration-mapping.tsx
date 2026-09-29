'use client';
import { useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { inspirationMappingRequest, inspirationSuggestions } from '../../../lib/domain/inspiration-mapping.js';
import { mutateInspiration } from '../../../lib/services/inspiration-mutations.js';
import type { Inspiration } from '../hooks/use-inspiration-library';
import { TrackerDialog } from './tracker-dialog';
import styles from '../inspiration.module.css';

export function InspirationMapping({db,row,kind,items,creatives,initialTarget,run,close,done}:{db:SupabaseClient;row:Inspiration;kind:'angle'|'persona';items:Record<string,any>[];creatives:Record<string,any>[];initialTarget?:string;run:(op:()=>Promise<unknown>)=>Promise<unknown>;close:()=>void;done:(notice:string)=>void}) {
  const [snapshot]=useState(()=>inspirationSuggestions(row,kind,items,creatives));
  const [mode,setMode]=useState(initialTarget?'existing':'custom'),[targetId,setTargetId]=useState(initialTarget || ''),[name,setName]=useState(String(row[kind] || row.editFields[kind==='angle'?'detectedAngle':'detectedPersona'] || ''));
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false),[confirmed,setConfirmed]=useState(false);
  const pending=useRef<ReturnType<typeof inspirationMappingRequest>|null>(null),lock=useRef(false);
  const label=kind==='angle'?'Angle':'Persona';
  async function save() {
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try {
      if(!pending.current){if(mode==='new' && !confirmed)throw new Error('Confirm adding this entry to the product taxonomy.');pending.current=inspirationMappingRequest(row,kind,mode,name,snapshot.find((item)=>item.id===targetId));}
      let saved=false;
      await run(async()=>{try{await mutateInspiration(db,pending.current!);saved=true;}catch(cause){const definite=!!(cause as {definite?:boolean}).definite;if(definite)pending.current=null;setUncertain(!definite);setError(cause instanceof Error?cause.message:'Mapping failed.');}});
      if(saved)done(`${label} mapping saved${mode==='new'?' and added to this product':mode==='custom'?' as an inspiration-only label':''}.`);
    }catch(cause){setError(cause instanceof Error?cause.message:'Invalid mapping.');}
    finally{lock.current=false;setBusy(false);}
  }
  return <TrackerDialog title={`Map ${label}: ${row.formatName}`} busy={busy} error={error} onClose={close} closeLabel="Close mapping">
    <form onSubmit={(event)=>{event.preventDefault();void save();}}>
      <fieldset className={styles.mappingFields} disabled={busy || uncertain}>
        <legend>{label}</legend>
        <label><input type="radio" name="mapping-mode" checked={mode==='custom'} onChange={()=>setMode('custom')}/>Keep as custom label</label>
        <label><input type="radio" name="mapping-mode" checked={mode==='existing'} onChange={()=>setMode('existing')}/>Map to existing</label>
        {mode==='existing'?<select aria-label={`Existing ${label}`} value={targetId} onChange={(event)=>setTargetId(event.target.value)}><option value="">Select...</option>{snapshot.map((item)=><option key={item.id} value={item.id}>{item.name}{item.score>=.45?` (${Math.round(item.score*100)}% similar)`:''}</option>)}</select>:null}
        <label><input type="radio" name="mapping-mode" checked={mode==='new'} onChange={()=>{setMode('new');setConfirmed(false);}}/>Add as new {label}</label>
        {mode!=='existing'?<label>{label} name<input aria-label={`${label} name`} value={name} maxLength={200} onChange={(event)=>{setName(event.target.value);setConfirmed(false);}}/></label>:null}
        {mode==='new'?<label><input type="checkbox" checked={confirmed} onChange={(event)=>setConfirmed(event.target.checked)}/>Add to this product's {kind==='angle'?'Angles':'Personas'} tab</label>:null}
      </fieldset>
      {uncertain?<p role="status">Save unconfirmed. Retry recovers the same request without adding another entry.</p>:null}
      <footer className={styles.editorFooter}><button type="button" disabled={busy} onClick={close}>Cancel</button><button type="submit" disabled={busy}>{busy?'Saving...':uncertain?'Retry same mapping':'Confirm mapping'}</button></footer>
    </form>
  </TrackerDialog>;
}
