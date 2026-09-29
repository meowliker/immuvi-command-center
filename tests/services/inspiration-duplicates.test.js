import test from 'node:test';
import assert from 'node:assert/strict';
import { mutateInspiration } from '../../lib/services/inspiration-mutations.js';
import { QA_SUPABASE_URL } from '../../lib/qa-supabase-env.js';
test('duplicate review uses its guarded RPC and verifies the exact reviewed evidence',async()=>{
  const request={p_product_id:'qa',p_request_id:'receipt',p_id:'INS',p_operation:'dismiss_duplicate',p_values:{children:[],duplicateSignature:'snapshot'}};
  const saved={productId:'qa',requestId:'receipt',id:'INS',operation:'dismiss_duplicate',remoteAdIds:[],dispatchEnabled:false,row:{id:'INS',product_id:'qa',updated_at:'v2',data:{_qaDupeReviewSignature:'snapshot',_dupeBannerDismissed:true}}};
  const db={supabaseUrl:QA_SUPABASE_URL,rpc:async(name)=>{assert.equal(name,'qa_inspiration_duplicate_review');return{data:saved};}};
  assert.deepEqual(await mutateInspiration(db,request),saved);
  for(const patch of [{_qaDupeReviewSignature:'wrong'},{_qaDupeReviewSignature:null},{_dupeBannerDismissed:false}]) {
    db.rpc=async()=>({data:{...saved,row:{...saved.row,data:{...saved.row.data,...patch}}}});
    await assert.rejects(mutateInspiration(db,request),/Duplicate review could not be verified/);
  }
});
