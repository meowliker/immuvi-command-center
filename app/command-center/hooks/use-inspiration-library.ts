'use client';
import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readProductRows } from '../../../lib/services/product-rows.js';
import { INSPIRATION_FILTERS, filterInspirations, projectInspirationLibrary } from '../../../lib/domain/inspiration-library.js';
import { useLiveQuery } from './use-live-query';
import { useReconciledState } from './use-reconciled-state';
import { activeInspirationTaxonomy, eligibleInspirationCreatives } from '../../../lib/domain/inspiration-mapping.js';
import { inspirationDuplicateState } from '../../../lib/domain/inspiration-duplicates.js';

export type Inspiration = ReturnType<typeof projectInspirationLibrary>[number] & ReturnType<typeof inspirationDuplicateState>;
export function useInspirationLibrary(db: SupabaseClient, productId: string) {
  const [rows, setRows] = useReconciledState<Inspiration[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filters, setFilters] = useState({ ...INSPIRATION_FILTERS });
  const [sort, setSort] = useState({ key: 'createdAt', direction: -1 });
  const [selectedId, setSelectedId] = useState('');
  const [taxonomy,setTaxonomy]=useReconciledState<{angle:string[];persona:string[]}>({angle:[],persona:[]});
  const [taxonomyRows,setTaxonomyRows]=useReconciledState<{angle:Record<string,any>[];persona:Record<string,any>[]}>({angle:[],persona:[]});
  const [creatives,setCreatives]=useReconciledState<ReturnType<typeof eligibleInspirationCreatives>>([]);
  const tables = ['inspirations', 'inspiration_queue', 'ads', 'deleted_ads', 'matrix_cells','angles','personas'];
  const live = useLiveQuery({ supabase: db, productId, tables, enabled: Boolean(productId),
    load: async (signal) => {
      const [inspirations, queue, ads, deleted, cells,angles,personas] = await Promise.all(tables.map((table) => readProductRows(db, table, productId, signal)));
      const privateResult=await db.rpc('qa_private_inspiration_status',{p_product_id:productId}).abortSignal(signal);
      if(privateResult.error)throw new Error('Private inspiration queue is unavailable.');
      const privateJobs=new Map<string,Record<string,any>>([...(privateResult.data||[])].reverse().map((job:Record<string,any>)=>[job.inspiration_id,job]));
      const displayQueue=queue.map(row=>{const job=privateJobs.get(row.ins_id);return job?{...row,status:job.status==='running'?'classifying':job.status,worker_assignment:job.scope || 'private',error_message:job.error||''}:row.worker_assignment==='blocked:qa-isolation'?{...row,status:'blocked',worker_assignment:'private',error_message:'Not queued on your private worker. Check your worker and ClickUp connection, then use Process All with Codex.'}:row;});
      const eligible=eligibleInspirationCreatives(productId,ads,deleted);
      const next = projectInspirationLibrary(productId, inspirations, displayQueue, ads, deleted, cells).map((row)=>({...row,...inspirationDuplicateState(row,eligible)}));
      const active={angle:activeInspirationTaxonomy(productId,angles),persona:activeInspirationTaxonomy(productId,personas)};
      return () => { setRows(next);setTaxonomyRows(active);setCreatives(eligible);setTaxonomy({angle:active.angle.map((row)=>row.name),persona:active.persona.map((row)=>row.name)}); setLoaded(true); setSelectedId((id) => next.some((row) => row.id === id) ? id : ''); };
    } });
  return { ...live, rows, taxonomy, taxonomyRows, creatives, loaded, filters, setFilters, sort, setSort, selectedId, setSelectedId,
    selected: rows.find((row) => row.id === selectedId) || null, visible: filterInspirations(rows, filters, sort) };
}
