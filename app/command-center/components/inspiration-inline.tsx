'use client';
import { useRef, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Inspiration } from '../hooks/use-inspiration-library';
import { inspirationDraft, inspirationRequest } from '../../../lib/domain/inspiration-editing.js';
import { saveInspiration } from '../services/save-inspiration';
import styles from '../inspiration.module.css';

export type InlineDraft={row:Inspiration;field:string;label:string;initial?:string;options?:string[]};
export function InspirationInline({draft,db,run,close,done}:{draft:InlineDraft;db:SupabaseClient;run:(op:()=>Promise<unknown>)=>Promise<unknown>;close:()=>void;done:(notice:string)=>void}) {
  const initial=inspirationDraft(draft.row)[draft.field] || '';
  const [value,setValue]=useState(draft.initial ?? initial),[busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false);
  const pending=useRef<ReturnType<typeof inspirationRequest>|null>(null),lock=useRef(false);
  const multiline=['notes','creativeHypothesis','formatDetail'].includes(draft.field);
  async function save() {
    if(lock.current)return;
    if(!pending.current && value.trim()===initial.trim()){close();return;}
    lock.current=true;setBusy(true);setError('');
    try {
      pending.current ||= inspirationRequest(draft.row.productId,'save',draft.row,{[draft.field]:value});
      let notice='';
      await run(async()=>{try {notice=await saveInspiration(db,pending.current!);}catch(cause){
        const definite=!!(cause as {definite?:boolean}).definite;
        if(definite)pending.current=null;setUncertain(!definite);setError(cause instanceof Error?cause.message:'Save failed.');
      }});
      if(notice)done(notice);
    }catch(cause){setError(cause instanceof Error?cause.message:'Invalid draft.');}
    finally {lock.current=false;setBusy(false);}
  }
  return <form className={styles.inlineEditor} aria-label={`Edit ${draft.label} for ${draft.row.id}`} onSubmit={(event)=>{event.preventDefault();void save();}} onKeyDown={(event)=>{
    if(event.key==='Escape' && !busy){event.preventDefault();event.stopPropagation();close();}
    if(event.key==='Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.target instanceof HTMLTextAreaElement){event.preventDefault();void save();}
  }}>
    {draft.options?<select autoFocus aria-label={draft.label} disabled={busy || uncertain} value={value} onChange={(event)=>setValue(event.target.value)}><option value="">-</option>{[...new Set([...draft.options,value].filter(Boolean))].map((option)=><option key={option}>{option}</option>)}</select>
      :multiline?<textarea autoFocus aria-label={draft.label} rows={3} maxLength={20000} disabled={busy || uncertain} value={value} onChange={(event)=>setValue(event.target.value)}/>
      :<input autoFocus aria-label={draft.label} maxLength={draft.field==='formatName'?200:20000} disabled={busy || uncertain} value={value} onChange={(event)=>setValue(event.target.value)}/>}
    <div className={styles.commands}><button type="submit" disabled={busy} title={uncertain?'Retry same save':'Save field'} aria-label={uncertain?'Retry same inline save':'Save field'}>{uncertain?<RotateCcw size={14}/>:<Check size={14}/>}</button><button type="button" disabled={busy} onClick={close} title="Cancel edit" aria-label="Cancel inline edit"><X size={14}/></button></div>
    {error?<p role="alert" className={styles.error}>{error}</p>:null}
    {uncertain?<p role="status">Save unconfirmed. Retry recovers the same request; reopening discards this retry.</p>:null}
  </form>;
}
