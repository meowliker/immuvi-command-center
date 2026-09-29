import { normalizeCreativeRow } from './creative-tracker.js';
import { planLifecycleRows } from './action-plan-visibility.js';
import { normalizeTaxonomyName, taxonomyKey } from './taxonomy.js';

export const HQ_FIELD_OPTIONS = {
  creativeStructure: ['UGC', 'Testimonial', 'Demo', 'Tutorial / How-To', 'Story / Narrative', 'Hook + Offer', 'Listicle', 'Static / Photo', 'Comparison', 'Interview', 'Skit / Roleplay', 'AI / Voiceover'],
  hookType: ['Pain / Problem', 'Fear', 'Curiosity', 'Social Proof', 'Aspirational', 'Direct Offer', 'Controversy / Bold Claim', 'POV', 'Question', 'News / Trend', 'Pattern Interrupt'],
  productionStyle: ['Organic / Raw UGC', 'Polished UGC', 'Professional Studio', 'AI Generated', 'Screen Record', 'Animation / Motion', 'Static Graphic', 'Slideshow', 'Repurposed Organic', 'Competitor Inspired'],
};
const GROUPS = [['angle', 'Angles'], ['persona', 'Personas'], ['creativeStructure', 'Creative Structure'], ['hookType', 'Hook Type'], ['productionStyle', 'Production Style']];
const statusKey = (value) => String(value || '').trim().toLowerCase();
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const cellKey = (ad) => JSON.stringify([taxonomyKey(ad.angle), taxonomyKey(ad.persona)]);

/** @param {{productId: string, ads?: Array<Record<string, any>>, angles?: Array<Record<string, any>>, personas?: Array<Record<string, any>>, tombstones?: Array<Record<string, any>>, fieldOptions?: Record<string, {name:string,desc:string}[]>}} input */
export function commandHqSnapshot({ productId, ads = [], angles = [], personas = [], tombstones = [], fieldOptions = {} }) {
  const scoped = (rows) => rows.filter((row) => productId && row.product_id === productId);
  const axes = (rows) => [...new Map(scoped(rows).filter((row) => !row.archived_at && taxonomyKey(row.name))
    .map((row) => [taxonomyKey(row.name), { ...row, name: normalizeTaxonomyName(row.name) }])).values()];
  const activeAngles = axes(angles);
  const activePersonas = axes(personas);
  const creatives = planLifecycleRows([], scoped(ads), scoped(tombstones)).ads.map(normalizeCreativeRow);
  const summary = { total: creatives.length, winners: 0, testing: 0, ready: 0, untested: 0, winRate: 0, angles: activeAngles.length, personas: activePersonas.length };
  const byField = new Map(GROUPS.map(([field]) => [field, new Map()]));
  const cells = new Map();
  const children = new Map();
  for (const ad of creatives) {
    const status = statusKey(ad.status);
    if (['winner', 'mild winner', 'scale'].includes(status)) summary.winners++;
    if (status === 'testing') summary.testing++;
    if (status === 'ready to launch') summary.ready++;
    if (status === 'untested') summary.untested++;
    for (const [field] of GROUPS) {
      const name = field === 'angle' || field === 'persona' ? taxonomyKey(ad[field]) : String(ad[field] || '').trim();
      if (name) byField.get(field).set(name, (byField.get(field).get(name) || 0) + 1);
    }
    const cell = cellKey(ad);
    if (!cells.has(cell)) cells.set(cell, new Set());
    cells.get(cell).add(String(ad.funnelStage).trim().toUpperCase());
    if (ad.parentAdId) children.set(ad.parentAdId, (children.get(ad.parentAdId) || 0) + 1);
  }
  summary.winRate = summary.total ? summary.winners / summary.total * 100 : 0;
  const coverage = GROUPS.map(([field, label]) => {
    const counts = byField.get(field);
    const names = field === 'angle' ? activeAngles.map((row) => row.name) : field === 'persona' ? activePersonas.map((row) => row.name)
      : [...new Set([...(Array.isArray(fieldOptions[field]) ? fieldOptions[field].map((option) => option.name) : HQ_FIELD_OPTIONS[field]), ...counts.keys()])];
    const items = names.map((name) => ({ name, count: counts.get(field === 'angle' || field === 'persona' ? taxonomyKey(name) : name) || 0 }));
    const covered = items.filter((item) => item.count > 0).length;
    return { field, label, items, covered, total: items.length, percent: items.length ? Math.round(covered / items.length * 100) : 0 };
  });
  const gaps = [];
  const unstarted = activeAngles.filter((row) => statusKey(row.status || 'Untested') === 'untested').length;
  if (unstarted) gaps.push(`${plural(unstarted, 'angle')} not started.`);
  const untestedPersonas = coverage[1].items.filter((item) => !item.count).length;
  if (untestedPersonas) gaps.push(`${plural(untestedPersonas, 'persona')} untested.`);
  // Legacy recommendations use root Winners, unlike the broader winner KPI.
  const winners = creatives.filter((ad) => statusKey(ad.status) === 'winner' && !ad.parentAdId);
  const winningCells = new Set(winners.filter((ad) => taxonomyKey(ad.angle) && taxonomyKey(ad.persona)).map(cellKey));
  let missingCells = 0;
  let missingStages = 0;
  for (const cell of winningCells) {
    const missing = ['TOF', 'MOF', 'BOF'].filter((stage) => !cells.get(cell).has(stage)).length;
    if (missing) { missingCells++; missingStages += missing; }
  }
  if (missingCells) gaps.push(`${plural(missingCells, 'winner combo')} missing ${plural(missingStages, 'funnel stage')}.`);
  for (const winner of winners) {
    const missing = 5 - (children.get(winner.id) || 0);
    if (missing > 0) gaps.push(`${winner.id} needs ${plural(missing, 'more variation')}.`);
  }
  for (const field of ['creativeStructure', 'hookType']) {
    const count = coverage.find((group) => group.field === field).items.filter((item) => !item.count).length;
    if (count) gaps.push(`${plural(count, field === 'creativeStructure' ? 'creative structure' : 'hook type')} untested.`);
  }
  return { summary, coverage, gaps };
}
