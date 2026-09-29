import { trackerDraft, trackerSaveValues } from './tracker-editing.js';
export const PRODUCTION_FIELDS=['formatName','format','angle','persona','adType','funnelStage','adLink','driveLink','dueDate','creativeHypothesis','notes'];
export function productionDraft() { const draft=trackerDraft();return Object.fromEntries(PRODUCTION_FIELDS.map((key)=>[key,draft[key] || ''])); }
export function productionRequest(productId,draft,requestId) {
  if(!productId || !/^[0-9a-f-]{36}$/i.test(requestId || ''))throw new Error('A product and request identity are required.');
  if(!draft.formatName?.trim() || draft.formatName.trim().length>500)throw new Error('Enter a task name of 1 to 500 characters.');
  const values=trackerSaveValues({...trackerDraft(),...draft,status:'Untested'});
  delete values.status;
  // Older pending requests have no format key; retain their exact receipt identity.
  if(Object.hasOwn(draft,'format')) {
    if(typeof draft.format!=='string' || draft.format.trim().length>500)throw new Error('Format must be at most 500 characters.');
    values.format=draft.format.trim();
  }
  values.meta=Object.fromEntries(Object.entries(values.meta).filter(([key])=>['dueDate','_dueDateMs','notes','creativeHypothesis'].includes(key)));
  return {p_product_id:productId,p_request_id:requestId,p_values:values};
}
