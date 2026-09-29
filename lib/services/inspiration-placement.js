import { QA_SUPABASE_URL } from '../qa-supabase-env.js';

export async function placeInspiration(db, request) {
  if (db.supabaseUrl?.replace(/\/$/,'') !== QA_SUPABASE_URL) throw new Error('Matrix placement is restricted to QA.');
  const result = await db.rpc('qa_matrix_create',request);
  if (result.error) throw Object.assign(new Error(result.error.message || 'Placement failed.'),{definite:/^(P0001|22|23|42501)/.test(result.error.code || '')});
  const ids = result.data;
  const uncertain = () => new Error('Placement could not be verified. Retry the same placement to recover its result.');
  if (!Array.isArray(ids) || ids.length !== 1 || typeof ids[0] !== 'string' || !ids[0]) throw uncertain();
  const [ad,cell] = await Promise.all([
    db.from('ads').select('id,product_id,meta,deleted_at').eq('product_id',request.p_product_id).eq('id',ids[0]).maybeSingle(),
    db.from('matrix_cells').select('product_id,angle_id,persona_id,creative_assignments,meta').eq('product_id',request.p_product_id).eq('angle_id',request.p_angle_id).eq('persona_id',request.p_persona_id).maybeSingle(),
  ]);
  if (ad.error || cell.error || ad.data?.id !== ids[0] || ad.data.product_id !== request.p_product_id || ad.data.deleted_at
    || ad.data.meta?._productBoundaryQuarantined || (ad.data.meta?._fromInspoId || ad.data.meta?._sourceInsId) !== request.p_items[0].sourceId
    || cell.data?.product_id !== request.p_product_id || cell.data.angle_id !== request.p_angle_id || cell.data.persona_id !== request.p_persona_id
    || !Array.isArray(cell.data.creative_assignments) || !cell.data.creative_assignments.includes(ids[0]) || cell.data.meta?._excludedCreativeIds?.includes(ids[0])) throw uncertain();
  return ids[0];
}
