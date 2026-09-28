import {REVIEW_VERSION, reviewInput, evidenceFor, validateAssessment, normalizedName} from './taxonomy-review-core.mjs';

const eligible = new Set(['Classified','Approved','Testing','Winner','Mild Winner','Scale','Placed']);
const escape = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stable = value => JSON.stringify(value);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(query) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      typeof query.abortSignal === 'function' ? query.abortSignal(controller.signal) : query,
      new Promise((_, reject) => {timer = setTimeout(() => {controller.abort(); reject(new Error('Review request timed out. Retry.'));}, 20000);})
    ]);
  } finally {clearTimeout(timer);}
}

export async function signature(input) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stable(input)));
  return REVIEW_VERSION + ':' + Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}

export function createReviewClient({context, paint, apply, confirm, notify, later = setTimeout, digest = signature}) {
  let scope = '', rows = new Map(), running = false, timer = null;
  function current() {
    const c = context();
    return c?.userId && c.product?.id && c.sb ? c : null;
  }
  function scopeKey(c) {return [c.userId, c.product.id, c.generation].join('|');}
  function valid(c) {const now = current(); return now && scopeKey(now) === scopeKey(c);}
  function inputFor(c, ins) {return reviewInput(c.product, c.angles, c.personas, ins);}
  function entryFor(ins) {
    const c = current();
    if (!c || scope !== scopeKey(c) || (ins.product_id && ins.product_id !== c.product.id)) return null;
    const entry = rows.get(ins.id);
    return entry && entry.inputText === stable(inputFor(c, ins)) ? entry : null;
  }
  function assessment(ins, kind) {
    const c = current(), entry = entryFor(ins), result = entry?.job?.result;
    if (!c || entry?.job?.status !== 'complete' || !result || result.version !== REVIEW_VERSION || result.productId !== c.product.id || result.insId !== ins.id || result.productName !== c.product.name || stable(result.evidence) !== stable(evidenceFor(ins))) return null;
    return validateAssessment(result[kind], kind, inputFor(c, ins));
  }
  function queue() {
    if (running || timer || !current()) return;
    timer = later(() => {timer = null; pump();}, 16);
  }
  async function pump() {
    const c = current();
    if (!c || running) return;
    running = true;
    if (scope !== scopeKey(c)) {scope = scopeKey(c); rows = new Map();}
    let changed = false;
    try {
      const pending = [...rows.values()].filter(e => ['pending','running'].includes(e.job?.status));
      if (pending.length) {
        const response = await request(c.sb.from('taxonomy_review_jobs').select('*').eq('product_id', c.product.id).in('id', pending.map(e => e.job.id)));
        if (response.error) throw new Error('Could not load reviews. Retry.');
        if (!valid(c)) return;
        for (const job of response.data || []) {
          const entry = rows.get(job.ins_id);
          if (job.product_id === c.product.id && entry?.job?.id === job.id) {
            changed ||= stable(entry.job) !== stable(job);
            entry.job = job;
          }
        }
      }
      let slots = 4 - [...rows.values()].filter(e => ['pending','running'].includes(e.job?.status)).length;
      for (const ins of [...c.inspirations].reverse()) {
        if (slots <= 0 || !valid(c)) break;
        if (!eligible.has(ins.status) || (ins.product_id && ins.product_id !== c.product.id)) continue;
        const input = inputFor(c, ins), inputText = stable(input);
        if (rows.get(ins.id)?.inputText === inputText) continue;
        await wait(16);
        const hash = await digest(input);
        if (!valid(c)) return;
        const entry = {inputText, hash, job:null, error:''};
        rows.set(ins.id, entry);
        const response = await request(c.sb.rpc('request_taxonomy_review', {p_product_id:c.product.id, p_ins_id:ins.id, p_signature:hash, p_retry:false}));
        if (!valid(c)) return;
        if (response.error) {
          entry.error = 'Review unavailable. Retry';
          changed = true;
          break;
        }
        const job = Array.isArray(response.data) ? response.data[0] : response.data;
        if (!job || job.product_id !== c.product.id || job.ins_id !== ins.id || job.requested_signature !== hash) throw new Error('Invalid review response.');
        entry.job = job;
        changed = true;
        slots--;
      }
    } catch (_) {
      for (const entry of rows.values()) if (['pending','running'].includes(entry.job?.status)) entry.error = 'Review connection interrupted. Retry';
      changed = true;
    } finally {
      if (valid(c) && changed) paint();
      running = false;
      const unvisited = valid(c) && c.inspirations.some(i => eligible.has(i.status) && (!i.product_id || i.product_id === c.product.id) && !rows.has(i.id));
      if (valid(c) && (unvisited || [...rows.values()].some(e => !e.error && ['pending','running'].includes(e.job?.status)))) {
        if (!timer) timer = later(() => {timer = null; pump();}, 5000);
      }
      if (!valid(c)) queue();
    }
  }
  async function retry(id) {
    const c = current(), ins = c?.inspirations.find(i => i.id === id), entry = ins && entryFor(ins);
    if (!c || !ins) return;
    if (entry?.job?.status === 'failed') {
      let response;
      try {response = await request(c.sb.rpc('request_taxonomy_review', {p_product_id:c.product.id, p_ins_id:id, p_signature:entry.hash, p_retry:true}));}
      catch (_) {notify('Review request timed out. Retry when the connection is available.'); return;}
      if (!valid(c)) return;
      if (response.error) {notify('Could not retry the review. Check the Mac mini worker.'); return;}
      const job = Array.isArray(response.data) ? response.data[0] : response.data;
      if (!job || job.product_id !== c.product.id || job.ins_id !== id) return;
      entry.job = job; entry.error = '';
    } else if (entry) {
      entry.error = '';
      if (!entry.job) rows.delete(id);
    }
    paint(); queue();
  }
  function accept(id, kind) {
    if (!['angle','persona'].includes(kind)) return;
    const c = current(), ins = c?.inspirations.find(i => i.id === id);
    const result = ins && assessment(ins, kind);
    if (!c || !result?.name || result.decision === 'needs_review') return;
    const message = (result.isNew ? 'Create a new ' : 'Use the existing ') + kind + ' "' + result.name + '" for this inspiration?\n\n' + result.reason + '\n\n' + result.productReason + '\n\nEvidence:\n' + result.evidence.map(e => e.quote).join('\n') + '\n\nExisting creatives and briefs will not be moved or regenerated.';
    if (!confirm(message) || !valid(c)) return;
    const latest = assessment(ins, kind);
    if (!latest || latest.name !== result.name || latest.decision !== result.decision) {notify('The evidence changed. Review the updated suggestion first.'); return;}
    apply(id, kind, result.name);
  }
  function render(ins, kind) {
    if (!ins || !eligible.has(ins.status)) return '';
    const entry = entryFor(ins), result = assessment(ins, kind);
    const style = 'display:block;margin-top:4px;border:1px solid #cbd5e1;background:#f8fafc;color:#334155;border-radius:4px;padding:3px 6px;font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    let label = 'Review on Mac mini', title = 'Review queued when this product is open', action = '';
    if (entry?.error || entry?.job?.status === 'failed') {
      label = 'Review failed - Retry'; title = entry.error || entry.job.error_message || label; action = 'retry';
    } else if (entry?.job?.status === 'running') label = 'Reviewing on Mac mini';
    else if (entry?.job?.status === 'pending') label = 'Queued on Mac mini';
    else if (entry?.job?.status === 'complete') {
      if (!result) {label = 'Evidence changed - re-review'; title = 'Reload this product to review the latest saved evidence.';}
      else if (result.decision === 'needs_review') {label = 'Needs source review'; title = result.reason;}
      else if (normalizedName(result.name) === normalizedName(ins[kind])) {label = 'Match confirmed'; title = result.reason;}
      else {label = (result.isNew ? 'New: ' : 'Suggested: ') + result.name; title = result.reason + '\n' + result.productReason; action = 'accept';}
    }
    const attrs = ' style="' + style + '" title="' + escape(title) + '"';
    if (!action) return '<span' + attrs + '>' + escape(label) + '</span>';
    // Encode arguments as JSON then HTML-escape the complete event handler.
    const handler = 'event.stopPropagation();window.ImmuviTaxonomyReview.' + action + '(' + JSON.stringify(ins.id) + ',' + JSON.stringify(kind) + ')';
    return '<button type="button"' + attrs + ' onclick="' + escape(handler) + '">' + escape(label) + '</button>';
  }
  return {queue, pump, assessment, render, accept, retry};
}

if (typeof window !== 'undefined') {
  window.ImmuviTaxonomyReview = createReviewClient({
    context:() => window._taxonomyReviewContext?.(), paint:() => window._taxonomyReviewPaint?.(),
    apply:(id, kind, name) => window.updateInsField(id, kind, name), confirm:message => window.confirm(message),
    notify:message => window.toast(message, 'warn')
  });
  window.ImmuviTaxonomyReview.queue();
}
