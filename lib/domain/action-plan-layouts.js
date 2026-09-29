import { timestampMs } from './action-plan.js';

const FALLBACK_STATUSES = ['Untested', 'In Production', 'Ready to Launch', 'Testing', 'Winner', 'Loser'];
const statusKey = (value) => String(value || '').trim().toLowerCase() || 'unassigned';

export function planPipelineGroups(actions, statuses = [], allActions = actions) {
  const groups = new Map();
  const add = (label) => {
    if (typeof label !== 'string' || !label.trim()) return;
    const key = statusKey(label);
    if (!groups.has(key)) groups.set(key, { key, label: label.trim(), actions: [] });
  };
  const configured = Array.isArray(statuses) ? statuses.filter((item) => typeof item?.status === 'string' && item.status.trim()) : [];
  configured.slice().sort((a, b) => (Number(a.orderindex) || 0) - (Number(b.orderindex) || 0)).forEach((item) => add(item.status));
  for (const action of allActions) add(String(action.display.status || '').trim() || 'Unassigned');
  if (!groups.size) FALLBACK_STATUSES.forEach(add);
  for (const action of actions) {
    add(String(action.display.status || '').trim() || 'Unassigned');
    groups.get(statusKey(action.display.status)).actions.push(action);
  }
  return [...groups.values()];
}

/** @returns {{ start: number, end: number, future: boolean, created: number, launched: number, decided: number }[]} */
export function planWeekDays(actions, nowMs = Date.now()) {
  const now = new Date(nowMs);
  if (!Number.isFinite(now.getTime())) return [];
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() || 7) - 1));
  const days = Array.from({ length: 7 }, (_, index) => {
    const start = new Date(monday), end = new Date(monday);
    start.setDate(monday.getDate() + index); end.setDate(monday.getDate() + index + 1);
    return { start: start.getTime(), end: end.getTime(), future: start.getTime() > nowMs, created: 0, launched: 0, decided: 0 };
  });
  for (const { display } of actions) {
    const created = timestampMs(display.createdAt), changed = timestampMs(display.lastStatusChangeAt);
    for (const day of days) {
      if (day.future) continue;
      if (created !== null && created >= day.start && created < day.end) day.created++;
      if (changed !== null && changed >= day.start && changed < day.end) {
        if (/testing|live/i.test(display.status)) day.launched++;
        if (/winner|loser/i.test(display.status)) day.decided++;
      }
    }
  }
  return days;
}
