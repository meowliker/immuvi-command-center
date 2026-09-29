import { normalizeCreativeRow } from './creative-tracker.js';

export const IMAGE_BUCKET = 'qa-producer-images';
export function producerSuggestions(rows, target, memory = {}, now = Date.now()) {
  const styles = memory.creative_direction_layer?.production_styles || [];
  return rows.filter(a => a.id !== target.id && a.productId === target.productId && !a.deletedAt
    && !a.productBoundaryQuarantined && /winner|scale/i.test(a.status) && /photo|static|image/i.test(`${a.adType} ${a.creativeStructure}`))
    .map(a => {
      const style = styles.find(s => String(s.name).toLowerCase() === String(a.productionStyle || a.creativeStructure).toLowerCase());
      const rate = style && style.wins + style.losses > 0 ? style.wins / (style.wins + style.losses) : 0;
      const same = Boolean(target.persona && a.persona === target.persona);
      const age = Math.max(0, (now - (a.lastStatusChangeAt || a.updatedAt || a.createdAt || 0)) / 86400000);
      const recent = Math.max(0, 1 - age / 120);
      return { ...a, score: .45 * rate * (/mild/i.test(a.status) ? .4 : 1) + .35 * Number(same) + .2 * recent,
        reasons: [same && 'Same persona', rate >= .5 && 'Strong-win format', recent >= .6 && 'Recent'].filter(Boolean),
        why: memory.winner_briefs?.find(b => b.task_id === a.clickupTaskId)?.why_it_won || '' };
    }).sort((a,b) => b.score-a.score).slice(0,10);
}

// Copy only creative context. Worker prompts never receive credentials or task endpoints.
export function producerBrief(row) {
  const a = normalizeCreativeRow(row);
  return Object.fromEntries(['formatName','angle','persona','adType','funnelStage','creativeHypothesis','creativeStructure','productionStyle','hookType','creativeUSP','notes']
    .map(key => [key, String(a[key] || '').slice(0,12000)]));
}
export function producerInstruction(options) {
  return `[PRODUCT DIRECTIVES - MANDATORY FOR EVERY IMAGE]
CANONICAL PRODUCT NAME: ${options.productName}
FORBIDDEN PRODUCT ALIASES / INVENTED NAMES: ${options.forbiddenAliases || 'None specified'}
OFFER TO FEATURE: ${options.offer || 'No additional offer specified; do not invent one'}
TALENT / MARKET: ${options.market || 'Use the audience in the brief'}
Use the canonical product name. Do not invent claims, prices, discounts or substitute brands.
[REFERENCE LAYOUT QA]
Match reference orientation, aspect ratio, logo/header, headline, body, product, CTA and whitespace zones.
Preserve text alignment, hierarchy, line count, font-size proportions and padding. Reject typography drift or awkward line breaks.
Variation 1 must be reference-faithful. Subsequent variations preserve the core persuasion mechanic.
[USER DIRECTION]
${options.instruction || 'Follow the creative hypothesis.'}`;
}
export function imageWorkerOnline(worker, now = Date.now()) {
  const age = now - Date.parse(worker?.heartbeat_at || '');
  return worker?.generation_available === true && age >= -5000 && age < 45000;
}
export function canQueueImageWorker(worker,now=Date.now()) {
  if(!worker?.enabled)return false;
  if(worker.scope!=='shared')return imageWorkerOnline(worker,now);
  const age=now-Date.parse(worker.heartbeat_at || '');
  return worker.image_protocol===1 && (!Number.isFinite(age) || age>=45000 || imageWorkerOnline(worker,now));
}
