import { inspirationLink } from './inspiration-library.js';
export const INSPIRATION_FIELDS = ['formatName','brand','platform','addedBy','angle','persona','hookType','creativeStructure','productionStyle','funnelStage','adType','creativeHypothesis','notes','bodyCopy','voiceOver'];
/** @returns {Record<string,string>} */
export function inspirationDraft(row) {
  return {...Object.fromEntries(INSPIRATION_FIELDS.map((key) => [key, String(row?.editFields?.[key] ?? '')])), ...(row ? {formatDetail: row.formatDetail || ''} : {})};
}
export function inspirationValues(fields, create = false) {
  const result = {};
  for (const [key, value] of Object.entries(fields)) {
    if (![...INSPIRATION_FIELDS, ...(create ? ['sourceUrl'] : ['formatDetail'])].includes(key) || typeof value !== 'string' || value.length > 20000) throw new Error(`Invalid inspiration field: ${key}`);
    result[key] = value.trim();
  }
  if ('formatName' in result && (!result.formatName || result.formatName.length > 200)) throw new Error('Format name must be 1-200 characters.');
  if (create) {
    result.sourceUrl = inspirationLink(result.sourceUrl);
    if (!result.sourceUrl || result.sourceUrl.length > 4000) throw new Error('Enter a valid source URL.');
    const host = new URL(result.sourceUrl).hostname.toLowerCase();
    result.platform ||= /(^|\.)instagram\.com$/.test(host) ? 'Instagram' : /(^|\.)facebook\.com$/.test(host) ? 'Facebook'
      : /(^|\.)tiktok\.com$/.test(host) ? 'TikTok' : /(^|\.)(youtube\.com|youtu\.be)$/.test(host) ? 'YouTube' : 'Other';
  }
  return result;
}
export function inspirationRequest(productId, operation, row, fields = {}, extra = {}, requestId = crypto.randomUUID()) {
  if (!['create','save','approve','requeue','delete','dismiss_duplicate','import'].includes(operation)) throw new Error('Unsupported inspiration operation.');
  if (!productId || (operation !== 'create' && (!row?.version || row.productId !== productId || row.queueOnly))) throw new Error('A saved inspiration in the active product is required. Refresh first.');
  const values = operation === 'create' || operation === 'save' ? inspirationValues(fields, operation === 'create') : {};
  const review=operation==='dismiss_duplicate'?row?.duplicateSignature:null;
  if(operation==='dismiss_duplicate' && (typeof review!=='string' || !review || review.length>1000000))throw new Error('Refresh and open a current duplicate match before reviewing.');
  return { p_product_id: productId, p_request_id: requestId, p_operation: operation, p_id: row?.id || null, p_expected_updated_at: row?.version || null,
    p_values: { fields: values, queue: row?.queueSnapshot || null,
      children: (row?.usage || []).map((ad) => ({ id: ad.id, version: ad.version })).sort((a, b) => a.id.localeCompare(b.id)), ...extra, ...(review?{duplicateSignature:review}:{}) } };
}
