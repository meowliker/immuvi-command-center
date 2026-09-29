import { timestampMs } from './action-plan.js';
import { planDateRange } from './action-plan-dates.js';

export const PLAN_PULSE_TODAY = ['created', 'briefed', 'production', 'ready', 'launched', 'decisions'];
export const PLAN_PULSE_PERIOD = ['created', 'tested', 'launched', 'decided', 'winners', 'killed'];
export const PLAN_PULSE_LABELS = { created: 'Created', briefed: 'Briefed', production: 'In Production', ready: 'Ready', launched: 'Launched', decisions: 'Decisions', tested: 'Tested', decided: 'Decided', winners: 'Winners', killed: 'Killed' };
const metrics = [...new Set([...PLAN_PULSE_TODAY, ...PLAN_PULSE_PERIOD])];

export function planMetricMatches(status, metric) {
  const value = String(status || '').trim().toLowerCase();
  switch (metric) {
    case 'created': return true;
    case 'briefed': return /brief|approved|untested|to do/.test(value);
    case 'production': return /production|in progress/.test(value);
    case 'ready': return /ready/.test(value);
    case 'tested': case 'launched': return /testing|live/.test(value);
    case 'winners': return /winner|scaling/.test(value) || value === 'scale';
    case 'killed': return /loser|kill/.test(value);
    case 'decisions': case 'decided': return planMetricMatches(value, 'winners') || planMetricMatches(value, 'killed') || value === 'complete';
    default: return false;
  }
}

export function planPulseKeys(keys) {
  return [...new Set((Array.isArray(keys) ? keys : []).filter((key) => typeof key === 'string'
    && key.split(':').length === 2 && /^(today|week):/.test(key) && (key.startsWith('today:') ? PLAN_PULSE_TODAY : PLAN_PULSE_PERIOD).includes(key.split(':')[1])))];
}

export function planPulseMatches(status, keys) {
  const selected = planPulseKeys(keys).map((key) => key.split(':')[1]).filter((metric) => metric !== 'created');
  return !selected.length || selected.some((metric) => planMetricMatches(status, metric));
}

export function togglePlanPulse(filters, key) {
  if (!planPulseKeys([key]).length) return filters;
  if (filters.pulseRange && filters.datePreset === 'all' && key.startsWith('today:')) {
    return togglePlanPulse({ ...filters, pulseRange: false, pulseKeys: [] }, key);
  }
  const keys = planPulseKeys(filters.pulseKeys);
  const next = keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key];
  return {
    ...filters, pulseKeys: next, status: /** @type {string[]} */ ([]),
    dateMode: !next.length && filters.pulseRange ? filters.dateMode : next.length && next.every((item) => item.endsWith(':created')) ? 'lifetime' : 'window',
    ...(!filters.pulseRange ? { datePreset: next.length ? next.at(-1).split(':')[0] : 'all', dateFrom: '', dateTo: '' } : {}),
  };
}

export function planPulse(actions, filters, now = Date.now()) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const todayEnd = planDateRange({ datePreset: 'today' }, now).to;
  const range = planDateRange(filters.pulseRange ? filters : { datePreset: 'week' }, now);
  const from = range.from ?? today.getTime(), to = range.to ?? now + 1;
  const end = to;
  const previousStart = from - (end - from);
  const empty = () => Object.fromEntries(metrics.map((metric) => [metric, 0]));
  const counts = { today: empty(), week: empty(), previous: empty(), delta: empty() };
  const allTime = filters.pulseRange && filters.datePreset === 'all';
  function count(target, display, start, stop) {
    for (const metric of metrics) {
      const stamp = timestampMs(metric === 'created' ? display.createdAt : display.lastStatusChangeAt);
      if (stamp !== null && stamp >= start && stamp < stop && planMetricMatches(display.status, metric)) target[metric]++;
    }
  }
  for (const { display } of actions) {
    count(counts.today, display, today.getTime(), todayEnd);
    if (allTime) {
      for (const metric of metrics) if (planMetricMatches(display.status, metric)) counts.week[metric]++;
    } else if (!range.error) {
      count(counts.week, display, from, end);
      count(counts.previous, display, previousStart, from);
    }
  }
  for (const metric of metrics) counts.delta[metric] = counts.week[metric] - counts.previous[metric];
  return counts;
}

export function latestPlanActivity(actions) {
  let latest = null;
  for (const { display } of actions) for (const value of [display.createdAt, display.lastStatusChangeAt]) {
    const stamp = timestampMs(value);
    if (stamp !== null && (latest === null || stamp > latest)) latest = stamp;
  }
  return latest;
}
