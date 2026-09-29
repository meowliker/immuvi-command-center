import { QA_SUPABASE_URL } from '../qa-supabase-env.js';
import { validateTaxonomyRequest } from '../domain/taxonomy-mutations.js';

export async function previewTaxonomyRename(db, request) {
  if (db.supabaseUrl?.replace(/\/$/, '') !== QA_SUPABASE_URL) throw new Error('Taxonomy previews are restricted to QA.');
  validateTaxonomyRequest(request);
  if (request.p_operation !== 'save') throw new Error('Only saved taxonomy entries can be renamed.');
  const source = request.p_values.sources[0];
  const { data, error } = await db.rpc('qa_taxonomy_rename_preview', {
    p_product_id: request.p_product_id, p_kind: request.p_kind, p_source: source, p_name: request.p_values.fields.name,
  });
  if (error) throw new Error(error.message || 'Rename preview failed.');
  if (!data || data.productId !== request.p_product_id || data.kind !== request.p_kind
    || data.source?.id !== source.id || data.source?.version !== source.version
    || data.afterName !== request.p_values.fields.name || typeof data.beforeName !== 'string' || data.beforeName === data.afterName
    || !/^[a-f0-9]{32}$/.test(data.revision) || data.dispatchEnabled !== false
    || ['ads', 'inspirations', 'actions'].some((key) => !Number.isSafeInteger(data.counts?.[key]) || data.counts[key] < 0)) {
    throw new Error('Rename preview could not be verified. No changes were sent.');
  }
  return data;
}

export async function mutateTaxonomy(db, request) {
  if (db.supabaseUrl?.replace(/\/$/, '') !== QA_SUPABASE_URL) throw Object.assign(new Error('Taxonomy changes are restricted to QA.'), { definite: true });
  validateTaxonomyRequest(request);
  const { data: result, error } = await db.rpc('qa_taxonomy_mutate', request);
  if (error) throw Object.assign(new Error(error.message || 'Taxonomy save failed.'), { definite: /^(P0001|22|23|42501)/.test(error.code || '') });
  const operation = request.p_operation, values = request.p_values;
  const expectedRemoved = ['merge', 'delete'].includes(operation) ? values.sources.map((row) => row.id).sort() : [];
  const expectedId = operation === 'create' ? `${request.p_kind === 'angle' ? 'ang' : 'per'}-${request.p_request_id}`
    : operation === 'merge' ? values.target.id : values.sources[0].id;
  const invalid = () => { throw new Error('Taxonomy save could not be verified. Retry the same request to recover its acknowledgement.'); };
  if (!result || result.requestId !== request.p_request_id || result.productId !== request.p_product_id || result.kind !== request.p_kind
    || result.operation !== operation || result.dispatchEnabled !== false || !Number.isSafeInteger(result.remotePending) || result.remotePending < 0
    || !Array.isArray(result.removedIds) || JSON.stringify([...result.removedIds].sort()) !== JSON.stringify(expectedRemoved)
    || !result.counts || ['ads', 'inspirations', 'actions', 'cells', 'links'].some((key) => !Number.isSafeInteger(result.counts[key]) || result.counts[key] < 0)) invalid();
  if (operation === 'delete') { if (result.row !== null) invalid(); }
  else {
    if (result.row?.id !== expectedId || result.row?.product_id !== request.p_product_id || !Number.isFinite(Date.parse(result.row?.updated_at))) invalid();
    if (['save', 'create'].includes(operation) && Object.entries(values.fields).some(([key, value]) => result.row[key] !== value)) invalid();
    if (operation === 'archive' && !Number.isFinite(Date.parse(result.row.archived_at))) invalid();
    if (['restore', 'create', 'merge'].includes(operation) && result.row.archived_at != null) invalid();
  }
  if (values.renameRevision && (result.rename?.revision !== values.renameRevision || result.rename?.requestId !== request.p_request_id
    || result.rename?.source?.id !== values.sources[0].id || result.rename?.source?.version !== values.sources[0].version
    || result.rename?.afterName !== values.fields.name || typeof result.rename?.beforeName !== 'string'
    || result.rename?.afterVersion !== result.row?.updated_at || result.rename?.productId !== request.p_product_id
    || result.rename?.kind !== request.p_kind || result.rename?.dispatchEnabled !== false
    || ['ads', 'inspirations', 'actions', 'cells', 'links'].some((key) => result.rename?.counts?.[key] !== result.counts[key]))) invalid();
  return result;
}
