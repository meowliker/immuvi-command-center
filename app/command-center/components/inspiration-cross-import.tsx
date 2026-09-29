'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '../types';
import type { Inspiration } from '../hooks/use-inspiration-library';
import { readProductRows } from '../../../lib/services/product-rows.js';
import { crossProductSources, crossImportRequest, importSourceKey } from '../../../lib/domain/inspiration-cross-import.js';
import { crossImportInspirations } from '../../../lib/services/inspiration-cross-import.js';
import { TrackerDialog } from './tracker-dialog';
import styles from '../inspiration-import.module.css';

type Source = ReturnType<typeof crossProductSources>[number];
export function InspirationCrossImport({db,productId,products,destinationRows,run,close,done}: {
  db:SupabaseClient;productId:string;products:Product[];destinationRows:Inspiration[];
  run:(op:()=>Promise<unknown>)=>Promise<unknown>;close:()=>void;done:(notice:string)=>void;
}) {
  const [productIds,setProductIds]=useState<string[]>([]),[rows,setRows]=useState<Source[]>([]),[selected,setSelected]=useState<Source[]>([]);
  const [kind,setKind]=useState('inspiration'),[search,setSearch]=useState(''),[sort,setSort]=useState('newest');
  const [loading,setLoading]=useState(false),[readError,setReadError]=useState(''),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
  const pending=useRef<ReturnType<typeof crossImportRequest>|null>(null),lock=useRef(false);
  const otherProducts=products.filter((product)=>product.id!==productId);
  const scope=JSON.stringify(productIds.filter((id)=>otherProducts.some((product)=>product.id===id)).sort());
  const latest=useRef({products,destinationRows});
  useLayoutEffect(()=>{latest.current={products,destinationRows};},[products,destinationRows]);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setReadError('');setRows([]);
    const ids:string[]=JSON.parse(scope);
    void Promise.all(ids.map(async(id)=>{
      const product=latest.current.products.find((item)=>item.id===id)!;
      const [inspirations,queue,ads,deleted]=await Promise.all(['inspirations','inspiration_queue','ads','deleted_ads'].map((table)=>readProductRows(db,table,id,controller.signal)));
      return crossProductSources(product,inspirations,queue,ads,deleted,latest.current.destinationRows);
    })).then((all)=>{if(!controller.signal.aborted)setRows(all.flat());})
      .catch((cause)=>{if(!controller.signal.aborted)setReadError(cause instanceof Error?cause.message:'Could not load sources.');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[db,scope,attempt]);
  const allowed=new Set<string>(JSON.parse(scope));
  const selectedKeys=new Set(selected.map(importSourceKey));
  const visible=rows.filter((row)=>allowed.has(row.sourceProductId) && row.kind===kind && [row.name,row.sourceId,row.brand,row.angle,row.persona,row.sourceProductName].join(' ').toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>sort==='name' ? a.name.localeCompare(b.name)||a.sourceId.localeCompare(b.sourceId) : b.createdAt-a.createdAt||a.sourceId.localeCompare(b.sourceId));
  const available=visible.filter((row)=>!row.disabled && !row.existing);
  const frozen=busy || uncertain;
  function toggleProduct(id:string) {
    setRows([]);setLoading(true);setReadError('');setError('');
    setProductIds((ids)=>ids.includes(id)?ids.filter((value)=>value!==id):[...ids,id]);
    setSelected((items)=>items.filter((row)=>row.sourceProductId!==id));
  }
  async function submit() {
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try {
      pending.current ||= crossImportRequest(productId,selected);
      let notice='';
      await run(async()=>{
        try {const saved=await crossImportInspirations(db,pending.current!);notice=`${saved.imported} imported; ${saved.existing} already present. Source products were not changed.`;}
        catch(cause){const definite=!!(cause as {definite?:boolean}).definite;if(definite)pending.current=null;setUncertain(!definite);setError(cause instanceof Error?cause.message:'Import failed.');}
      });
      if(notice)done(notice);
    } catch(cause){setError(cause instanceof Error?cause.message:'Could not start import.');}
    finally{lock.current=false;setBusy(false);}
  }
  return <TrackerDialog title="Browse Other Products" busy={busy} error={error} closeLabel="Close product import" onClose={close}>
    <div className={styles.layout}>
      <fieldset className={styles.products} disabled={frozen}><legend>Products</legend>
        {otherProducts.length ? otherProducts.map((product)=><label key={product.id}><input type="checkbox" checked={productIds.includes(product.id)} onChange={()=>toggleProduct(product.id)}/><span>{product.name || product.id}</span></label>) : <p>No other accessible products.</p>}
      </fieldset>
      <div className={styles.preview}>
        <div role="group" aria-label="Import source type" className={styles.tabs}>
          {[['inspiration','Inspirations'],['winner','Winning Formats']].map(([value,label])=><button type="button" key={value} aria-pressed={kind===value} onClick={()=>setKind(value)}>{label}</button>)}
        </div>
        <div className={styles.toolbar}>
          <input type="search" aria-label="Search import sources" placeholder="Search sources" value={search} onChange={(event)=>setSearch(event.target.value)}/>
          <select aria-label="Sort import sources" value={sort} onChange={(event)=>setSort(event.target.value)}><option value="newest">Newest first</option><option value="name">Name</option></select>
          <button type="button" aria-label="Refresh import sources" title="Refresh sources and clear selection" disabled={frozen || loading} onClick={()=>{setSelected([]);setError('');setAttempt((value)=>value+1);}}><RefreshCw size={16}/></button>
        </div>
        {readError ? <p role="alert">{readError}</p> : loading ? <p role="status">Loading sources...</p> : !productIds.length ? <p>Select source products.</p> : !visible.length ? <p>No matching sources.</p> : null}
        <div className={styles.tableRegion} role="region" aria-label="Cross-product import sources" tabIndex={0}>
          <table><thead><tr><th><input type="checkbox" aria-label="Select visible import sources" disabled={frozen || loading || !!readError || !available.length} checked={!!available.length && available.every((row)=>selectedKeys.has(importSourceKey(row)))} onChange={(event)=>setSelected((items)=>event.target.checked ? [...items,...available.filter((row)=>!selectedKeys.has(importSourceKey(row)))] : items.filter((row)=>!available.some((source)=>importSourceKey(source)===importSourceKey(row))))}/></th>
            {['ID','Format Name','Brand','Angle','Persona','Hook','Structure','Funnel','Status','From'].map((label)=><th key={label}>{label}</th>)}</tr></thead>
            <tbody>{visible.map((row)=><tr key={importSourceKey(row)}>
              <td><input type="checkbox" aria-label={`Import ${row.name} from ${row.sourceProductName}`} disabled={frozen || loading || !!readError || row.disabled || row.existing} checked={selectedKeys.has(importSourceKey(row))} onChange={(event)=>setSelected((items)=>event.target.checked?[...items,row]:items.filter((item)=>importSourceKey(item)!==importSourceKey(row)))}/></td>
              {[row.sourceId,row.name,row.brand,row.angle,row.persona,row.hook,row.structure,row.funnel,row.existing?'Already imported':row.status,row.sourceProductName].map((value,index)=><td key={index}>{value || '-'}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
    {uncertain ? <p role="status">The import may already be saved. Retry uses the same request and selection.</p> : null}
    <footer className={styles.footer}><span>{selected.length} selected{selected.length>50?' / Maximum 50 per import':''}</span><button type="button" disabled={busy} onClick={close}>Cancel</button>
      <button type="button" disabled={busy || (!uncertain && (loading || !!readError || !selected.length || selected.length>50 || selected.some((row)=>!allowed.has(row.sourceProductId))))} onClick={()=>void submit()}><Download size={16}/>{busy?'Importing...':uncertain?'Retry same import':'Import selected'}</button>
    </footer>
  </TrackerDialog>;
}
