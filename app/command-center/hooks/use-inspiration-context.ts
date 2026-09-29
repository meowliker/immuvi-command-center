'use client';
import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '../types';
import type { Inspiration } from './use-inspiration-library';
import { useLiveQuery } from './use-live-query';
import { readProductRows } from '../../../lib/services/product-rows.js';
import { inspirationContext } from '../../../lib/domain/inspiration-context.js';

export function useInspirationContext(db:SupabaseClient, productId:string, products:Product[], rows:Inspiration[]) {
  const scope=JSON.stringify([productId,...products.map((product)=>product.id).sort()]);
  const [snapshot,setSnapshot]=useState<{scope:string;rows:Record<string,any>[]}|null>(null);
  const live=useLiveQuery({supabase:db,productId:'',scopeKey:`inspiration-context:${scope}`,tables:['inspirations','products','user_products'],
    load:async(signal)=>{
      const all:Record<string,any>[]=[];
      for(const product of products) {
        if(product.id===productId)continue;
        all.push(...await readProductRows(db,'inspirations',product.id,signal));
      }
      return ()=>setSnapshot({scope,rows:all});
    }});
  const loaded=snapshot?.scope===scope;
  return {...live,loaded,byId:loaded?inspirationContext(productId,rows,products,snapshot.rows):{}};
}
