import { inspirationRequest } from './inspiration-editing.js';
import { inspirationLink } from './inspiration-library.js';

export const INSPIRATION_BATCH_LIMIT = 50;
const timestamp = (value) => Date.parse(value || '');
export function inspirationResultIssue(row, result, productId) {
  if (!row || row.productId !== productId || row.queueOnly || !row.version) return 'Recover or save this inspiration first.';
  if (result.product_id !== productId || result.ins_id !== row.id || !result.id || !Number.isFinite(timestamp(result.classified_at))) return 'Result identity is invalid.';
  if (!row.sourceUrl || inspirationLink(result.source_url) !== row.sourceUrl) return 'Result source URL does not match.';
  if (['pending','processing','claimed','classifying'].includes(String(row.queueSnapshot?.status).toLowerCase())) return 'Classifier job is active.';
  if (timestamp(result.classified_at) < timestamp(row.queueSnapshot?.queued_at)) return 'Result predates the latest retry.';
  if (timestamp(result.classified_at) <= timestamp(row.editFields?._qaImportedResultAt)) return 'Already imported.';
  const c = result.classification || {}, b = result.brief || {};
  const filled = (object, keys) => keys.every((key) => typeof object[key] === 'string' && object[key].trim());
  if (!filled(c,['hook_type','creative_structure','production_style','funnel_type','persona','angle','creative_usp','creative_hypothesis'])) return 'Classification is incomplete.';
  if (!filled(b,['why_it_works','replication_brief','what_to_test','competitor_intel','our_next_ad','inspiration_script_skeleton'])
    || !Array.isArray(b.frame_by_frame) || !b.frame_by_frame.length || !Array.isArray(b.next_ad_scripts) || b.next_ad_scripts.length !== 3
    || b.next_ad_scripts.some((script) => !script || !filled(script,['variation','intent','hook_text','source_format_match','voice_over_script','cta','what_to_change','why_it_should_work'])
      || !Array.isArray(script.script_breakdown) || !script.script_breakdown.length)) return 'Eight-section brief is incomplete.';
  return '';
}

export function inspirationBatchCandidates(productId, rows, results) {
  const sources = new Map(rows.filter((row) => row.productId === productId).map((row) => [row.id,row]));
  const latest = new Map();
  for (const result of results) {
    if (result.product_id !== productId) continue;
    const previous = latest.get(result.ins_id);
    if (!previous || (timestamp(result.classified_at) || 0) > (timestamp(previous.classified_at) || 0)
      || (result.classified_at === previous.classified_at && String(result.id).localeCompare(String(previous.id)) > 0)) latest.set(result.ins_id,result);
  }
  return [...latest.values()].map((result) => {
    const row = sources.get(result.ins_id);
    return { id:result.ins_id, title:row?.formatName || result.ins_id, row, result, issue:inspirationResultIssue(row,result,productId) };
  }).sort((a,b) => a.id.localeCompare(b.id));
}

export function inspirationBatchRequests(productId, candidates, selected, uuid = () => crypto.randomUUID()) {
  if (!selected.length || selected.length > INSPIRATION_BATCH_LIMIT || new Set(selected).size !== selected.length) throw new Error('Select 1-50 different inspirations.');
  return selected.map((id) => {
    const candidate = candidates.find((item) => item.id === id);
    if (!candidate || candidate.issue) throw new Error('Selection is no longer eligible. Reload results.');
    return { id, title:candidate.title, status:'pending', error:'', warning:'', request:structuredClone(inspirationRequest(productId,'import',candidate.row,{},
      {result_id:candidate.result.id,result_at:candidate.result.classified_at},uuid())) };
  });
}
