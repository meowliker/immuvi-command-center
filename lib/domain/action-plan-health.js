import { timestampMs } from './action-plan.js';

const DAY = 86_400_000;
const key = (value) => String(value || '').trim().toLowerCase();
const terminal = new Set(['winner', 'loser', 'scale', 'mild winner', 'killed', 'complete', 'archived']);
export const PLAN_AGE_THRESHOLDS = Object.freeze({
  untested: [1, 2], brief: [1, 2], approved: [1, 2], 'in production': [1, 2],
  production: [1, 2], qa: [1, 2], review: [1, 2], 'ready to launch': [1, 3],
  ready: [1, 3], testing: [7, 14], live: [7, 14], winner: [5, 7],
  scaling: [14, 21], scale: [14, 21], loser: [3, 5], paused: null, archived: null, complete: null,
});

export function planAgeThresholds(overrides) {
  const thresholds = { ...PLAN_AGE_THRESHOLDS };
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return thresholds;
  for (const [status, value] of Object.entries(overrides)) {
    const name = key(status);
    if (!name || ['__proto__', 'constructor', 'prototype'].includes(name)) continue;
    if (value === null) thresholds[name] = null;
    else if (typeof value?.yellow === 'number' && typeof value?.red === 'number'
      && Number.isFinite(value.yellow) && Number.isFinite(value.red) && value.yellow >= 0 && value.red >= value.yellow) {
      thresholds[name] = [value.yellow, value.red];
    }
  }
  return thresholds;
}

export function planTerminalStatus(status, statuses = []) {
  return terminal.has(key(status)) || statuses.some((entry) => entry && key(entry.status) === key(status) && ['done', 'closed'].includes(key(entry.type)));
}

function fieldDate(ad, name) {
  return timestampMs(ad?._customFieldsRaw?.[name]) ?? timestampMs(ad?._customFields?.[name]);
}

export function planStatusTimestamp(ad, polluted = new Set(), now = Date.now(), linkedDone = null) {
  if (!ad) return null;
  const created = timestampMs(ad.createdAt), approved = fieldDate(ad, 'approved date'), launched = fieldDate(ad, 'launch date');
  let derived = null;
  switch (key(ad.status)) {
    case 'untested': derived = created; break;
    case 'in production': derived = approved ?? created; break;
    case 'ready to launch': derived = timestampMs(linkedDone) ?? approved ?? created; break;
    case 'testing': derived = launched ?? approved ?? created; break;
    case 'winner': case 'loser': case 'mild winner': case 'mild loser': case 'scale': case 'killed': case 'archived': derived = launched ?? created; break;
    case 'complete': derived = timestampMs(ad.updatedAt) ?? created; break;
  }
  const raw = timestampMs(ad.lastStatusChangeAt);
  const candidates = [raw !== null && !polluted.has(raw) ? raw : null, derived].filter((value) => value !== null);
  return candidates.length ? Math.min(now, Math.max(...candidates)) : null;
}

export function planTestingCheckpoint(status, entered, deferredAt, now = Date.now()) {
  if (key(status) !== 'testing' || entered === null) return { phase: 'none', dueAt: null };
  const deferred = timestampMs(deferredAt);
  if (deferred !== null) return { phase: now >= deferred + 7 * DAY ? 'final' : 'snoozed', dueAt: deferred + 7 * DAY };
  if (now >= entered + 14 * DAY) return { phase: 'final', dueAt: entered + 14 * DAY };
  return { phase: now >= entered + 7 * DAY ? 'first' : 'none', dueAt: entered + 7 * DAY };
}

export function planRowAge(display, entered, deferredAt, now, thresholds = PLAN_AGE_THRESHOLDS, statuses = []) {
  const since = entered ?? timestampMs(display.updatedAt) ?? timestampMs(display.createdAt);
  const neutral = { days: null, elapsedMs: null, label: '-', state: 'none', tooltip: 'No status timestamp yet', phase: 'none', dueAt: null };
  if (since === null) return neutral;
  const elapsedMs = Math.max(0, now - since), elapsed = elapsedMs / DAY;
  const days = elapsed < 1 ? Math.round(elapsed * 10) / 10 : Math.round(elapsed);
  const label = elapsed < 1 / 24 ? 'just now' : elapsed < 1 ? `${Math.round(elapsed * 24)}h` : `${days}d`;
  if (planTerminalStatus(display.status, statuses)) return { ...neutral, days, elapsedMs, label, tooltip: `Terminal status (${display.status}) - ${label} since launch` };
  const threshold = Object.hasOwn(thresholds, key(display.status)) ? thresholds[key(display.status)] : null;
  let state = threshold ? elapsed >= threshold[1] ? 'red' : elapsed >= threshold[0] ? 'yellow' : 'green' : 'none';
  const due = timestampMs(display.dueAtMs);
  const pastDue = key(display.status).includes('production') && due !== null && now > due;
  if (pastDue) state = 'red';
  const checkpoint = planTestingCheckpoint(display.status, entered, deferredAt, now);
  if (checkpoint.phase === 'first') return { days, elapsedMs, label: 'Day 7 review', state: 'red', tooltip: 'Day-7 checkpoint - review due', ...checkpoint };
  if (checkpoint.phase === 'final') return { days, elapsedMs, label: `Final - ${days}d`, state: 'red', tooltip: 'Final testing review - Winner / Loser / Mild Winner / Scale', ...checkpoint };
  if (checkpoint.phase === 'snoozed') return { days, elapsedMs, label: `${days}d (snoozed)`, state: 'none', tooltip: `Snoozed until ${new Date(checkpoint.dueAt).toLocaleString()}`, ...checkpoint };
  const tooltip = `In ${display.status || 'unknown status'} since ${new Date(since).toLocaleString()}. ${pastDue ? 'Production due date has passed. ' : ''}${threshold ? `Yellow ${threshold[0]}d; red ${threshold[1]}d.` : 'No threshold for this status.'}`;
  return { days, elapsedMs, label, state, tooltip, ...checkpoint };
}

/** Read-only health projection; shared baseline detection includes every product ad. */
export function planHealth(actions, ads, now = Date.now(), statuses = [], overrides = {}, linkedDone = new Map()) {
  const byProduct = new Map(), byAd = new Map();
  for (const ad of ads) {
    byAd.set(`${ad.productId}:${ad.id}`, ad);
    const counts = byProduct.get(ad.productId) || new Map();
    const stamp = timestampMs(ad.lastStatusChangeAt);
    if (stamp !== null) counts.set(stamp, (counts.get(stamp) || 0) + 1);
    byProduct.set(ad.productId, counts);
  }
  const polluted = new Map([...byProduct].map(([product, counts]) => [product, new Set([...counts].filter(([, count]) => count >= 5).map(([stamp]) => stamp))]));
  const thresholds = planAgeThresholds(overrides), ages = new Map(), groups = new Map(), projected = [];
  for (const action of actions) {
    const d = action.display, ad = byAd.get(`${d.productId}:${d.linkedAdId}`);
    const changed = ad && key(ad.status) !== key(d.status);
    const source = changed ? { ...ad, status: d.status, lastStatusChangeAt: d.lastStatusChangeAt } : ad;
    const entered = planStatusTimestamp(source, polluted.get(d.productId), now, linkedDone.get(d.linkedAdId))
      ?? timestampMs(action.payload?._statusChangedAt) ?? timestampMs(action.payload?._pushedAt)
      ?? (ad ? null : timestampMs(d.lastStatusChangeAt));
    const dueAtMs = timestampMs(action.payload?._dueDateMs) ?? timestampMs(ad?._dueDateMs) ?? d.dueAtMs;
    const age = planRowAge({ ...d, dueAtMs }, entered, changed ? null : ad?.testingDeferredAt, now, thresholds, statuses);
    projected.push(entered === d.lastStatusChangeAt && dueAtMs === d.dueAtMs ? action : { ...action, display: { ...d, lastStatusChangeAt: entered, dueAtMs } });
    ages.set(d.dbId, age);
    if (age.state === 'red') groups.set(d.status || 'Unknown', (groups.get(d.status || 'Unknown') || 0) + 1);
  }
  return { actions: projected, ages, groups, total: [...groups.values()].reduce((sum, count) => sum + count, 0) };
}
