import { timestampMs } from './action-plan.js';

export const PLAN_DATE_PRESETS = [
  ['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', 'Last 7 days'],
  ['14d', 'Last 14 days'], ['30d', 'Last 30 days'], ['week', 'This week'], ['lastweek', 'Last week'],
  ['month', 'This month'], ['lastmonth', 'Last month'], ['all', 'All time'], ['custom', 'Custom range'],
];
export function localPlanDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0); date.setFullYear(year, month - 1, day); date.setHours(0, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}
export function planDayKey(ms) {
  const d = new Date(ms);
  return `${String(d.getFullYear()).padStart(4, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function shifted(date, days) { const next = new Date(date); next.setDate(next.getDate() + days); return next; }

/** @returns {{from: number|null, to: number|null, error: string}} */
export function planDateRange(filters, nowMs = Date.now()) {
  const preset = filters.datePreset || 'all';
  const empty = { from: null, to: null, error: '' };
  if (preset === 'all') return empty;
  const today = new Date(nowMs); today.setHours(0, 0, 0, 0);
  if (!Number.isFinite(today.getTime())) return { ...empty, error: 'Invalid current date.' };
  let from = today, to = shifted(today, 1);
  const monday = shifted(today, -((today.getDay() || 7) - 1));
  switch (preset) {
    case 'today': break;
    case 'yesterday': from = shifted(today, -1); to = today; break;
    case '7d': from = shifted(today, -6); break;
    case '14d': from = shifted(today, -13); break;
    case '30d': from = shifted(today, -29); break;
    case 'week': from = monday; break;
    case 'lastweek': from = shifted(monday, -7); to = monday; break;
    case 'month': from = new Date(today); from.setDate(1); break;
    case 'lastmonth': to = new Date(today); to.setDate(1); from = new Date(to); from.setMonth(from.getMonth() - 1); break;
    case 'custom': {
      const start = localPlanDay(filters.dateFrom), end = localPlanDay(filters.dateTo);
      if (!start || !end) return { ...empty, error: 'Enter valid start and end dates.' };
      if (start > end) return { ...empty, error: 'End date must be on or after start date.' };
      from = start; to = shifted(end, 1); break;
    }
    default: return { ...empty, error: 'Select a valid date range.' };
  }
  // Exclusive next-day boundary includes every millisecond of the final date.
  return { from: from.getTime(), to: to.getTime(), error: '' };
}

export function planMatchesDate(display, filters, range) {
  if (range.error) return false;
  if (range.from === null) return true;
  const ts = timestampMs(filters.dateMode === 'lifetime' ? display.createdAt : display.lastStatusChangeAt);
  return ts !== null && ts >= range.from && ts < range.to;
}

export function planTrends(actions, nowMs = Date.now()) {
  const today = new Date(nowMs); today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 30 }, (_, index) => ({ date: planDayKey(shifted(today, index - 29)), created: 0, launched: 0, decided: 0 }));
  const byDate = new Map(days.map((day) => [day.date, day]));
  let winners = 0, losers = 0;
  for (const { display } of actions) {
    const created = timestampMs(display.createdAt), changed = timestampMs(display.lastStatusChangeAt);
    const creationDay = created === null ? undefined : byDate.get(planDayKey(created));
    const statusDay = changed === null ? undefined : byDate.get(planDayKey(changed));
    if (creationDay) creationDay.created++;
    if (statusDay && /testing|live/i.test(display.status)) statusDay.launched++;
    if (statusDay && /winner|loser/i.test(display.status)) statusDay.decided++;
    if (/winner/i.test(display.status)) winners++;
    if (/loser/i.test(display.status)) losers++;
  }
  return { days, winners, losers, winRate: winners + losers ? Math.round(winners * 100 / (winners + losers)) : 0 };
}
