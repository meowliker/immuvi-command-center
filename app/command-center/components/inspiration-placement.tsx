'use client';
import { useRef, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Inspiration } from '../hooks/use-inspiration-library';
import { useLiveQuery } from '../hooks/use-live-query';
import { readProductRows } from '../../../lib/services/product-rows.js';
import { placeInspiration } from '../../../lib/services/inspiration-placement.js';
import { inspirationPlacementIndex, suggestedInspirationCell, inspirationCellSummary, inspirationPlacementReason, inspirationPlacementRequest } from '../../../lib/domain/inspiration-placement.js';
import styles from '../inspiration.module.css';

type Cell = {angleId:string;personaId:string};
export function InspirationPlacement({db,productId,row,run}: {db:SupabaseClient;productId:string;row:Inspiration;run:(op:()=>Promise<unknown>)=>Promise<unknown>}) {
  const [index,setIndex] = useState<ReturnType<typeof inspirationPlacementIndex>|null>(null);
  const [selection,setSelection] = useState<Cell|null>(null);
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [notice,setNotice] = useState(''), [uncertain,setUncertain] = useState(false);
  const pending = useRef<ReturnType<typeof inspirationPlacementRequest>|null>(null), lock = useRef(false);
  const tables = ['angles','personas','ads','matrix_cells','deleted_ads'];
  const live = useLiveQuery({supabase:db,productId,tables,load:async(signal) => {
    const [angles,personas,ads,cells,deleted] = await Promise.all(tables.map((table) => readProductRows(db,table,productId,signal)));
    const next = inspirationPlacementIndex(productId,angles,personas,ads,cells,deleted);
    return () => setIndex(next);
  }});
  const suggested = index ? suggestedInspirationCell(row,index) : null;
  const suggestedSummary = index && suggested ? inspirationCellSummary(row,index,suggested) : null;
  const chosen = selection || suggested || {angleId:'',personaId:''};
  const reason = inspirationPlacementReason(row);
  const disabled = busy || uncertain || !!reason || !!live.error || !index;
  const summary = index ? inspirationCellSummary(row,index,chosen) : {total:0,winners:0,testing:0,placed:false};
  async function place(cell:Cell) {
    if (lock.current || !index) return;
    lock.current=true;setBusy(true);setError('');setNotice('');
    try {
      pending.current ||= inspirationPlacementRequest(productId,row,index,cell);
      let id = '';
      await run(async() => {
        try { id = await placeInspiration(db,pending.current!); }
        catch (cause) {
          const definite = !!(cause as {definite?:boolean}).definite;
          if (definite) pending.current=null;
          setUncertain(!definite);setError(cause instanceof Error ? cause.message : 'Placement failed.');
        }
      });
      if (id) { pending.current=null;setUncertain(false);setNotice(`Creative ${id} is in the selected cell.`);await live.refresh({background:true}); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not place inspiration.'); }
    finally {lock.current=false;setBusy(false);}
  }
  return <section className={styles.placement} aria-label="Place inspiration into Matrix">
    <h3>Place Into Matrix</h3>
    {live.error ? <p role="alert">{live.error} <button type="button" title="Retry Matrix destinations" aria-label="Retry Matrix destinations" disabled={busy} onClick={() => void live.refresh()}><RefreshCw size={14}/></button></p> : null}
    {!index && !live.error ? <p role="status">Loading Matrix cells...</p> : null}
    {reason ? <p>{reason}</p> : null}
    {suggested && index && suggestedSummary ? <div className={styles.suggestedCell}>
      <strong>{index.angles.find((axis) => axis.id===suggested.angleId)?.name} x {index.personas.find((axis) => axis.id===suggested.personaId)?.name}</strong>
      <span className={styles.cellCount} data-suggested-cell-count>{live.error?'Cell count unavailable':`${suggestedSummary.total} ${suggestedSummary.total===1?'ad':'ads'} in cell`}</span>
      <button type="button" className={styles.primaryPlacement} disabled={disabled || suggestedSummary.placed} onClick={() => void place(suggested)}><Plus size={14}/>Place in suggested cell</button>
    </div> : index ? <p>No unique active suggested cell.</p> : null}
    <div className={`${styles.suggestedCell} ${styles.selectedCell}`} data-selected-cell>
    <div className={styles.placementFields}>
      <label>Angle<select aria-label="Placement angle" disabled={disabled} value={chosen.angleId} onChange={(event) => setSelection({...chosen,angleId:event.target.value})}>
        <option value="">Pick angle</option>{chosen.angleId && !index?.angles.some((axis) => axis.id===chosen.angleId) ? <option value={chosen.angleId}>Unavailable angle</option> : null}
        {index?.angles.map((axis) => <option key={axis.id} value={axis.id}>{axis.name}</option>)}</select></label>
      <label>Persona<select aria-label="Placement persona" disabled={disabled} value={chosen.personaId} onChange={(event) => setSelection({...chosen,personaId:event.target.value})}>
        <option value="">Pick persona</option>{chosen.personaId && !index?.personas.some((axis) => axis.id===chosen.personaId) ? <option value={chosen.personaId}>Unavailable persona</option> : null}
        {index?.personas.map((axis) => <option key={axis.id} value={axis.id}>{axis.name}</option>)}</select></label>
    </div>
    {chosen.angleId && chosen.personaId ? <p className={styles.cellMetrics}>
      <span data-metric="creatives">{summary.total} {summary.total===1?'creative':'creatives'}</span><span aria-hidden="true"> / </span>
      <span data-metric="winners">{summary.winners} {summary.winners===1?'winner':'winners'}</span><span aria-hidden="true"> / </span>
      <span data-metric="testing">{summary.testing} testing</span>{summary.placed ? <span> / Already in cell</span> : null}
    </p> : null}
    <button type="button" className={styles.primaryPlacement} disabled={disabled || summary.placed || !index?.angles.some((axis) => axis.id===chosen.angleId) || !index?.personas.some((axis) => axis.id===chosen.personaId)} onClick={() => void place(chosen)}><Plus size={14}/>Place in selected cell</button>
    </div>
    {error ? <p role="alert">{error}</p> : null}{notice ? <p role="status">{notice}</p> : null}
    {uncertain ? <button type="button" disabled={busy} onClick={() => void place(chosen)}>Retry same placement</button> : null}
  </section>;
}
