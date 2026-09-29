import { timestampMs } from './action-plan.js';

export const PLAN_FACETS = ['status', 'angle', 'persona', 'funnelStage', 'adType', 'source'];
export const PLAN_FACET_LABELS = { status: 'Status', angle: 'Angle', persona: 'Persona', funnelStage: 'Funnel', adType: 'Type', source: 'Source' };
const identity = (key, value) => key === 'status' ? value.toLowerCase() : value;

export function planFacetValues(value, key) {
  const values = Array.isArray(value) ? value : [value];
  const seen = new Set();
  return values.filter((item) => {
    if (typeof item !== 'string' || !item) return false;
    const id = identity(key, item);
    if (seen.has(id)) return false;
    seen.add(id); return true;
  });
}

export function planFacetMatches(value, selected, key) {
  const values = planFacetValues(selected, key);
  return !values.length || values.some((item) => identity(key, item) === identity(key, String(value || '')));
}

export function planFacetOptions(actions, selected, key) {
  // Retain selections whose last matching task disappeared during a refresh.
  return planFacetValues([...selected, ...actions.map(({ display }) => key === 'source' ? display.source.kind : display[key])], key)
    .sort((a, b) => a.localeCompare(b));
}

export function togglePlanFacet(filters, key, value) {
  if (!PLAN_FACETS.includes(key) || typeof value !== 'string' || !value) return filters;
  const values = planFacetValues(filters[key], key);
  const selected = values.some((item) => identity(key, item) === identity(key, value));
  return { ...filters, [key]: selected ? values.filter((item) => identity(key, item) !== identity(key, value)) : [...values, value],
    ...(key === 'status' ? { pulseKeys: [] } : {}) };
}

export function planAnomalies(action, now = Date.now()) {
  const payload = action?.payload || {}, display = action?.display || {}, meta = action?.linkedAdMeta || {};
  const history = Array.isArray(payload._history) ? payload._history : [];
  const recent = (type, window) => {
    const event = [...history].reverse().find((entry) => entry?.type === type);
    const stamp = timestampMs(event?.ts);
    return stamp !== null && stamp > 0 && stamp <= now && now - stamp < window;
  };
  const result = [];
  if (payload._clickupTaskDeleted || display.clickupTaskDeleted) result.push({ type: 'cu_deleted', label: 'Deleted in CU', tone: 'red', tip: 'ClickUp task was deleted' });
  if (display.linkedAdId && payload._clickupId && meta.taskType && meta.taskType !== 'production' && recent('tag_removed', 14 * 86400000)) {
    result.push({ type: 'tag_removed', label: 'Tag removed', tone: 'amber', tip: 'Production tag removed in ClickUp within the last 14 days; task kept here' });
  }
  if (recent('relinked', 86400000)) result.push({ type: 'relinked', label: 'Re-linked', tone: 'sky', tip: 'Recovered link to ClickUp within the last 24 hours' });
  return result;
}
