'use client';
import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readProductRows } from '../../../lib/services/product-rows.js';
import { useLiveQuery } from './use-live-query';

export function useInspirationActivity(db: SupabaseClient, productId: string) {
  const [state,setState]=useState<{productId:string;ads:Record<string,any>[];briefs:Record<string,any>[];images:Record<string,any>[];imageWorkers:Record<string,any>[];privateJobs:Record<string,any>[];loaded:boolean;errors:string[]}>({productId,ads:[],briefs:[],images:[],imageWorkers:[],privateJobs:[],loaded:false,errors:[]});
  const live=useLiveQuery({supabase:db,productId,tables:['ads','variation_brief_queue','qa_image_runs','qa_image_worker'],load:async(signal)=>{
    const ads=await readProductRows(db,'ads',productId,signal,'id,product_id,format_name');
    async function readBriefs() {
      const rows:Record<string,any>[]=[];
      // Both ends of a variation must belong to the active product.
      const ids=ads.map(row=>row.id), allowed=new Set(ids);
      for(let offset=0;offset<ids.length;offset+=100)for(let from=0;;from+=500){
        const result=await db.from('variation_brief_queue').select('*').in('target_ad_id',ids.slice(offset,offset+100)).order('id').range(from,from+499).abortSignal(signal);
        if(result.error || !Array.isArray(result.data))throw new Error('Variation brief queue unavailable');
        rows.push(...result.data.filter(row=>allowed.has(row.parent_ad_id) && allowed.has(row.target_ad_id)));
        if(result.data.length<500)break;
      }
      return rows;
    }
    const results=await Promise.allSettled([
      readBriefs(),readProductRows(db,'qa_image_runs',productId,signal),
      db.rpc('qa_inspiration_workers_list',{p_product_id:productId}).abortSignal(signal).then(result=>{if(result.error || !Array.isArray(result.data))throw new Error('Image worker unavailable');return result.data;}),
      db.rpc('qa_private_inspiration_status',{p_product_id:productId}).abortSignal(signal).then(result=>{if(result.error || !Array.isArray(result.data))throw new Error('Private queue unavailable');return result.data;}),
    ]);
    const names=['Variation briefs','Image tasks','Image worker','Private queue'];
    return ()=>setState(old=>({productId,ads,loaded:true,errors:results.flatMap((result,index)=>result.status==='rejected'?[`${names[index]} unavailable`]:[]),
      ...Object.fromEntries((['briefs','images','imageWorkers','privateJobs'] as const).map((key,index)=>[key,results[index].status==='fulfilled'?results[index].value:old.productId===productId?old[key]:[]])),
    } as typeof old));
  }});
  const current=state.productId===productId?state:{productId,ads:[],briefs:[],images:[],imageWorkers:[],privateJobs:[],loaded:false,errors:[]};
  return {...current,errors:[...current.errors,...(live.error?[live.error]:[])],refresh:live.refresh,busy:live.busy};
}
