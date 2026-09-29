import { QA_SUPABASE_URL } from '../qa-supabase-env.js';
export async function mutateInspiration(db, request) {
  if (db.supabaseUrl?.replace(/\/$/,'') !== QA_SUPABASE_URL) throw new Error('Inspiration changes are restricted to QA.');
  const detail = request.p_operation === 'save' && Object.hasOwn(request.p_values.fields || {}, 'formatDetail');
  const mapping=request.p_operation==='save' && request.p_values.mapping;
  const review=request.p_operation==='dismiss_duplicate';
  const result = await db.rpc(review?'qa_inspiration_duplicate_review':mapping?'qa_inspiration_mapping':detail ? 'qa_inspiration_detail' : 'qa_inspiration_mutate', request);
  if (result.error) throw Object.assign(new Error(result.error.message || 'Inspiration save failed.'), { definite: /^(P0001|22|23|42501)/.test(result.error.code || '') });
  const saved = result.data;
  if (!saved || saved.requestId !== request.p_request_id || saved.productId !== request.p_product_id || saved.operation !== request.p_operation
    || (request.p_id && saved.id !== request.p_id) || !saved.id || saved.dispatchEnabled !== false || !Array.isArray(saved.remoteAdIds)
    || saved.remoteAdIds.some((id) => typeof id !== 'string' || !request.p_values.children.some((child) => child.id === id))
    || (request.p_operation === 'delete' ? saved.deleted !== true || saved.row !== null : saved.row?.id !== saved.id || saved.row?.product_id !== request.p_product_id || !saved.row?.updated_at))
    throw new Error('Save could not be verified. Retry this same request to recover its acknowledgement.');
  if (['save','create'].includes(request.p_operation) && Object.entries(request.p_values.fields || {}).some(([key,value]) =>
    key==='formatDetail'?false:key==='sourceUrl'?saved.row.url!==value:saved.row.data?.[key]!==value))
    throw new Error('Saved fields could not be verified. Retry this same request to recover its acknowledgement.');
  if (detail) {
    const value=request.p_values.fields.formatDetail.trim();
    const expected=(saved.row.data?.formatName || saved.row.title || '')+(value?' \u2014 '+value:'');
    if(saved.row.data?.creativeUSP!==expected)throw new Error('Detail save could not be verified. Retry this same request.');
  }
  if(mapping && (saved.mapping?.kind!==mapping.kind || saved.mapping?.mode!==mapping.mode || saved.mapping?.name!==request.p_values.fields[mapping.kind]
    || saved.row.data?.[mapping.kind]!==saved.mapping.name || saved.row.data?.[`_needs${mapping.kind==='angle'?'Angle':'Persona'}Review`]!==false
    || (mapping.mode==='existing'?saved.mapping.targetId!==mapping.targetId:mapping.mode==='new'?typeof saved.mapping.targetId!=='string' || !saved.mapping.targetId:saved.mapping.targetId!==null)))
    throw new Error('Mapping save could not be verified. Retry this same request.');
  if(review && (typeof request.p_values.duplicateSignature!=='string' || !request.p_values.duplicateSignature || saved.row.data?._qaDupeReviewSignature!==request.p_values.duplicateSignature || saved.row.data?._dupeBannerDismissed!==true))
    throw new Error('Duplicate review could not be verified. Retry this same request.');
  return saved;
}
