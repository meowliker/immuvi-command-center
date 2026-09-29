import { useEffect, useState, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { imageWorkerOnline } from '../../../lib/domain/image-producer.js';

export type ImageOutput = { path: string; filename: string; width: number; height: number; prompt: string; quality_checks: string[] };
export type ImageRun = { id: string; ad_id: string; status: string; outputs: ImageOutput[]; error: string | null; created_at: string };
export function useImageProducer(db: SupabaseClient, productId: string) {
  const [state,setState]=useState<{productId:string;runs:ImageRun[];online:boolean;memory:Record<string,unknown>;error:string}>({productId:'',runs:[],online:false,memory:{},error:''});
  const [revision,setRevision]=useState(0);
  const reload=useCallback(()=>setRevision(n=>n+1),[]);
  useEffect(()=>{
    let cancelled=false, timer:ReturnType<typeof setTimeout>;
    async function load(){
      try {
        const runs=await db.from('qa_image_runs').select('id,ad_id,status,outputs,error,created_at').eq('product_id',productId).order('created_at',{ascending:false}).limit(100);
        const worker=await db.rpc('qa_private_workers_list');
        const memory=await db.from('strategist_memory').select('json').eq('product_id',productId).maybeSingle();
        if(runs.error||worker.error)throw new Error('Image producer is unavailable. Check the QA queue setup.');
        if(!cancelled)setState({productId,runs:runs.data||[],online:(worker.data||[]).some((row:Record<string,unknown>)=>imageWorkerOnline(row)),memory:memory.data?.json||{},error:''});
      }catch(error){if(!cancelled)setState({productId,runs:[],online:false,memory:{},error:error instanceof Error?error.message:'Could not load image runs.'});}
      if(!cancelled)timer=setTimeout(load,5000);
    }
    void load();return()=>{cancelled=true;clearTimeout(timer);};
  },[db,productId,revision]);
  return { ...(state.productId===productId?state:{runs:[],online:false,memory:{},error:''}),reload };
}
