import { normalizeCreativeRow } from './creative-tracker.js';
import { planLifecycleRows } from './action-plan-visibility.js';
import { deriveTaxonomyStatus, normalizeTaxonomyName, normalizeTaxonomyRow, taxonomyKey, taxonomyStats } from './taxonomy.js';

/** @typedef {ReturnType<typeof normalizeCreativeRow>} Creative */
/** @typedef {ReturnType<typeof normalizeTaxonomyRow>} TaxonomyRow */
/** @param {{productId: string, kind: 'angle'|'persona', angles?: Record<string, any>[], personas?: Record<string, any>[], ads?: Record<string, any>[], tombstones?: Record<string, any>[]}} input */
export function taxonomyWorkspace({ productId, kind, angles = [], personas = [], ads = [], tombstones = [] }) {
  const scoped = (rows) => rows.filter((row) => productId && row.product_id === productId);
  const catalog = (rows) => scoped(rows).map(normalizeTaxonomyRow).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const rows = catalog(kind === 'angle' ? angles : personas);
  const oppositeRows = catalog(kind === 'angle' ? personas : angles);
  const creatives = planLifecycleRows([], scoped(ads), scoped(tombstones)).ads
    .map(normalizeCreativeRow).filter((ad) => !ad.parentAdId);
  return { rows, oppositeRows, creatives };
}

/** @param {'angle'|'persona'} kind @param {TaxonomyRow} row @param {Creative[]} creatives @param {TaxonomyRow[]} oppositeRows */
export function taxonomyRelationships(kind, row, creatives, oppositeRows = []) {
  const key = taxonomyKey(row.name);
  const opposite = kind === 'angle' ? 'persona' : 'angle';
  const matches = creatives.filter((ad) => ad.productId === row.productId && key && taxonomyKey(ad[kind]) === key);
  /** @type {Map<string, {key: string, name: string, row: TaxonomyRow|null, creatives: Creative[]}>} */
  const groups = new Map();
  for (const ad of matches) {
    const name = normalizeTaxonomyName(ad[opposite]);
    const groupKey = taxonomyKey(name);
    if (!groupKey) continue;
    if (!groups.has(groupKey)) {
      const candidates = oppositeRows.filter((peer) => peer.productId === row.productId && taxonomyKey(peer.name) === groupKey);
      const peer = candidates.find((candidate) => !candidate.archivedAt) || candidates[0];
      groups.set(groupKey, { key: groupKey, name: peer?.name || name, row: peer || null, creatives: [] });
    }
    groups.get(groupKey).creatives.push(ad);
  }
  // Reuse the shared winner/status rules after matching aliases canonically.
  const canonical = matches.map((ad) => ({ ...ad, [kind]: row.name, [opposite]: taxonomyKey(ad[opposite]) }));
  return { creatives: matches, groups: [...groups.values()].sort((a, b) => a.name.localeCompare(b.name)),
    status: deriveTaxonomyStatus(kind, row.name, canonical), stats: taxonomyStats(kind, row.name, canonical) };
}

export function taxonomyWorkspaceSummary(rows, relationships) {
  const summary = { total: rows.length, active: 0, archived: 0, winners: 0, testing: 0, untested: 0, totalCreatives: 0 };
  const ids = new Set();
  for (const row of rows) {
    if (row.archivedAt) summary.archived++; else summary.active++;
    const relation = relationships.get(row.id);
    if (['Winner', 'Mild Winner', 'Scale'].includes(relation.status)) summary.winners++;
    else if (relation.status === 'Testing') summary.testing++;
    else if (relation.status === 'Untested') summary.untested++;
    relation.creatives.forEach((ad) => ids.add(ad.id));
  }
  summary.totalCreatives = ids.size;
  return summary;
}
