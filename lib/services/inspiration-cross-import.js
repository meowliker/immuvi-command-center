import { QA_SUPABASE_URL } from '../qa-supabase-env.js';
import { importSourceKey } from '../domain/inspiration-cross-import.js';
export async function crossImportInspirations(db,request) {
  if(db.supabaseUrl?.replace(/\/$/,'')!==QA_SUPABASE_URL) throw new Error('Cross-product imports are restricted to QA.');
  const result=await db.rpc('qa_inspiration_cross_import',request);
  if(result.error) throw Object.assign(new Error(result.error.message || 'Import failed.'),{definite:/^(P0001|22|23|42501)/.test(result.error.code || '')});
  const saved=result.data;
  if(!saved || saved.requestId!==request.p_request_id || saved.productId!==request.p_product_id || saved.operation!=='cross_import' || saved.dispatchEnabled!==false
    || !Array.isArray(saved.items) || saved.items.length!==request.p_items.length
    || saved.items.some((item,index)=>!item || importSourceKey(item)!==importSourceKey(request.p_items[index]) || typeof item.id!=='string' || !item.id || !['imported','existing'].includes(item.status))
    || saved.imported!==saved.items.filter((item)=>item.status==='imported').length || saved.existing!==saved.items.filter((item)=>item.status==='existing').length)
    throw new Error('Import could not be verified. Retry the same import to recover its acknowledgement.');
  return saved;
}
