import { planLifecycleRows } from './action-plan-visibility.js';
import { normalizeCreativeRow } from './creative-tracker.js';
import { savedPlanCount } from './action-plan-count.js';

export function navigationCounts(rows, productId) {
  const scoped = (table) => (rows[table] || []).filter((row) => productId && row.product_id === productId);
  const angles = scoped('angles'), personas = scoped('personas');
  const ads = scoped('ads'), tombstones = scoped('deleted_ads');
  const visible = planLifecycleRows([], ads, tombstones).ads.map(normalizeCreativeRow);
  // Legacy badges count all creatives, but only top-level pairs occupy matrix cells.
  const occupied = new Set(visible.filter((ad) => !ad.parentAdId).map((ad) => JSON.stringify([ad.angle, ad.persona])));
  const competitors = scoped('competitor_brands');
  const saved = savedPlanCount(scoped('manual_actions'), ads, tombstones, productId);
  return {
    angles: angles.length,
    personas: personas.length,
    competitors: `${competitors.filter((brand) => brand.approved).length}/${competitors.length}`,
    'creative-tracker': visible.length,
    'creative-matrix': `${occupied.size}/${angles.length * personas.length}`,
    'action-plan': saved,
    production: saved,
    inspiration: scoped('inspirations').length,
  };
}
