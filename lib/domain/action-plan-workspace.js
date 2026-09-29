import { actionPlanBucket, isActionOverdue } from './action-plan.js';
import { planDateRange, planMatchesDate } from './action-plan-dates.js';
import { planPulseMatches } from './action-plan-pulse.js';
import { PLAN_FACETS, planFacetMatches, planAnomalies } from './action-plan-filters.js';
import { planPeopleLabel } from './action-plan-fields.js';

export const PLAN_BATCH_LIMIT = 100;
export const PLAN_FILTERS = {
  query: '', bucket: 'all', status: /** @type {string[]} */ ([]), angle: /** @type {string[]} */ ([]),
  persona: /** @type {string[]} */ ([]), funnelStage: /** @type {string[]} */ ([]), adType: /** @type {string[]} */ ([]), source: /** @type {string[]} */ ([]),
  due: '', datePreset: 'all', dateMode: 'window', dateFrom: '', dateTo: '', attentionOnly: false,
  anomaliesOnly: false, showHidden: false, includeAdopted: true, pulseRange: false, pulseKeys: /** @type {string[]} */ ([]),
};

export function filterPlanActions(actions, filters = PLAN_FILTERS, now = Date.now(), ages = new Map(), hiddenIds = new Set()) {
  const query = String(filters.query || '').trim().toLowerCase();
  const range = planDateRange(filters, now);
  return actions.filter((action) => {
    const d = action.display;
    if (filters.includeAdopted === false && d.isVirtual) return false;
    if (!filters.showHidden && d.linkedAdId && hiddenIds.has(d.linkedAdId)) return false;
    if (filters.attentionOnly && ages.get(d.dbId)?.state !== 'red') return false;
    if (filters.anomaliesOnly && !planAnomalies(action, now).length) return false;
    if (query && ![d.title, d.id, d.linkedAdId, d.clickupTaskId, d.angle, d.persona].join(' ').toLowerCase().includes(query)) return false;
    if (filters.bucket && filters.bucket !== 'all' && (filters.bucket === 'overdue' ? !isActionOverdue(d, now) : actionPlanBucket(d.status) !== filters.bucket)) return false;
    for (const field of PLAN_FACETS) if (!planFacetMatches(field === 'source' ? d.source.kind : d[field], filters[field], field)) return false;
    if (!planPulseMatches(d.status, filters.pulseKeys)) return false;
    if (filters.due === 'none' && d.dueDate) return false;
    if (filters.due === 'overdue' && !isActionOverdue(d, now)) return false;
    if (!planMatchesDate(d, filters, range)) return false;
    return true;
  });
}

export function sortPlanActions(actions, key = 'updatedAt', direction = -1, ages = new Map()) {
  if (!key.startsWith('cf:') && !['title', 'status', 'dueDate', 'angle', 'persona', 'createdAt', 'updatedAt', 'age', 'funnelStage', 'adType', 'editor', 'reviewer'].includes(key)) key = 'updatedAt';
  function value(action) {
    if (key === 'age') {
      const elapsed = ages.get(action.display.dbId)?.elapsedMs;
      return typeof elapsed === 'number' && Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null;
    }
    if (key === 'editor' || key === 'reviewer') {
      const label = planPeopleLabel(action.linkedAdMeta || {}, key);
      return label === 'Unassigned' ? '' : label;
    }
    return key.startsWith('cf:') ? action.linkedAdMeta?._customFields?.[key.slice(3)] : action.display[key];
  }
  return [...actions].sort((a, b) => {
    const av = value(a), bv = value(b);
    const emptyA = av === null || av === undefined || av === '', emptyB = bv === null || bv === undefined || bv === '';
    if (emptyA !== emptyB) return emptyA ? 1 : -1;
    const diff = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true });
    return diff * (direction === 1 ? 1 : -1) || a.display.dbId.localeCompare(b.display.dbId);
  });
}

export function planBatchItems(actions) {
  if (!actions.length || actions.length > PLAN_BATCH_LIMIT) throw new Error(`Select between 1 and ${PLAN_BATCH_LIMIT} visible tasks.`);
  const ids = new Set(), ads = new Set();
  return actions.map((action) => {
    const id = action.display.dbId, adId = action.display.linkedAdId || null;
    if (action.display.isVirtual) throw new Error('Save this adopted task before bulk editing.');
    if (!id || !action.actionVersion || (adId && !action.adVersion)) throw new Error('Task versions are missing. Refresh before editing.');
    if (ids.has(id) || (adId && ads.has(adId))) throw new Error('Duplicate task links must be resolved before bulk editing.');
    ids.add(id); if (adId) ads.add(adId);
    return { id, updated_at: action.actionVersion, ad_id: adId, ad_updated_at: action.adVersion || null };
  });
}
