import { normalizeActionAd, normalizeManualActionRow, resolveActionDisplay } from './action-plan.js';
import { planLifecycleRows } from './action-plan-visibility.js';

export function virtualPlanActions(records, manualRows, adRows, tombstones = [], removedIds = new Set()) {
  const eligible = planLifecycleRows(manualRows, adRows, tombstones);
  const covered = new Set(), tasks = new Set();
  const key = (product, id) => JSON.stringify([product, id]);
  for (const row of manualRows) {
    const p = row.payload || {};
    for (const id of [p.sourceAdId, p.adId, p._sourceAdId].filter(Boolean)) covered.add(key(row.product_id, id));
    for (const id of [p._clickupId, p.clickupTaskId].filter(Boolean)) tasks.add(key(row.product_id, id));
  }
  for (const { display: d } of records) {
    if (d.linkedAdId) covered.add(key(d.productId, d.linkedAdId));
    if (d.clickupTaskId) tasks.add(key(d.productId, d.clickupTaskId));
  }
  const ads = eligible.ads.map(normalizeActionAd);
  const duplicates = new Map();
  for (const ad of ads) if (ad.clickupTaskId) {
    const id = key(ad.productId, ad.clickupTaskId);
    duplicates.set(id, (duplicates.get(id) || 0) + 1);
  }
  return eligible.ads.flatMap((raw) => {
    const ad = normalizeActionAd(raw);
    if (!ad.id || !ad.productId || covered.has(key(ad.productId, ad.id)) || removedIds.has(key(ad.productId, ad.id))) return [];
    if (ad.clickupTaskId && (tasks.has(key(ad.productId, ad.clickupTaskId)) || duplicates.get(key(ad.productId, ad.clickupTaskId)) > 1)) return [];
    const payload = {
      id: `va:${ad.id}`, sourceAdId: ad.id, adId: ad.id, title: ad.formatName || ad.id,
      taskName: ad.formatName || ad.id, sourceAngle: ad.angle, sourcePersona: ad.persona,
      funnelStage: ad.funnelStage, format: ad.adType, liveStatus: ad.status,
      _clickupId: ad.clickupTaskId || null, clickupTaskId: ad.clickupTaskId || null,
      _origin: 'auto-adopted', _virtual: true, _clickupTaskDeleted: Boolean(ad._clickupTaskDeleted),
    };
    const display = resolveActionDisplay(normalizeManualActionRow({ id: payload.id, product_id: ad.productId, payload }), ads.filter((a) => a.productId === ad.productId));
    return [{ display, payload, linkedAdMeta: raw.meta || {}, adVersion: raw.updated_at || '', actionVersion: '' }];
  });
}

export function promotionArguments(productId, action) {
  const d = action?.display;
  if (!d?.isVirtual || d.productId !== productId || !d.linkedAdId || d.dbId !== `va:${d.linkedAdId}`
    || action.payload?.sourceAdId !== d.linkedAdId || !action.adVersion || d.clickupTaskDeleted || action.linkedAdMeta?._productBoundaryQuarantined) {
    throw new Error('Reload this adopted task before editing it.');
  }
  return { p_product_id: productId, p_ad_id: d.linkedAdId, p_expected_updated_at: action.adVersion };
}

export function planPresentationKeys(actions) {
  const links = new Map();
  const identity = (d) => JSON.stringify([d.productId, d.linkedAdId]);
  for (const { display: d } of actions) if (d.linkedAdId) links.set(identity(d), (links.get(identity(d)) || 0) + 1);
  return new Map(actions.map(({ display: d }) => [d.dbId,
    d.linkedAdId && links.get(identity(d)) === 1 ? `creative:${identity(d)}` : `action:${d.dbId}`]));
}

export function adoptedIdReplacements(previous, next) {
  const keys = planPresentationKeys(next);
  const saved = new Map(next.filter((a) => !a.display.isVirtual).map((a) => [keys.get(a.display.dbId), a.display.dbId]));
  return new Map(previous.filter((a) => a.display.isVirtual).flatMap(({ display: d }) => {
    const id = saved.get(`creative:${JSON.stringify([d.productId, d.linkedAdId])}`);
    return id ? [[d.dbId, id]] : [];
  }));
}
