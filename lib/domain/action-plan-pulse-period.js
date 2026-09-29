import { planDateRange, planDayKey } from './action-plan-dates.js';

export const PLAN_PULSE_PRESETS = [
  ['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This Week'],
  ['7d', 'Last 7d'], ['14d', 'Last 14d'], ['30d', 'Last 30d'],
  ['month', 'This month'], ['lastmonth', 'Last month'],
  ['all', 'All time'],
];

export function pulsePeriodLabel(filters) {
  if (!filters.pulseRange) return 'This Week';
  return filters.datePreset === 'custom' ? `${filters.dateFrom} to ${filters.dateTo}`
    : PLAN_PULSE_PRESETS.find(([key]) => key === filters.datePreset)?.[1] || 'Period';
}

export function pulsePeriodDraft(filters, now) {
  if (!filters.pulseRange) return { from: '', to: '' };
  const range = planDateRange(filters, now);
  return range.error || range.from === null || range.to === null ? { from: '', to: '' }
    : { from: planDayKey(range.from), to: planDayKey(range.to - 1) };
}

export function applyPulsePeriod(filters, preset, draft, now) {
  if (preset === 'reset') return { ...filters, datePreset: 'all', dateFrom: '', dateTo: '', pulseRange: false, pulseKeys: [] };
  if (preset !== 'custom' && !PLAN_PULSE_PRESETS.some(([key]) => key === preset)) throw new Error('Select a valid pulse period.');
  const next = { ...filters, datePreset: preset, dateFrom: preset === 'custom' ? draft?.from || '' : '', dateTo: preset === 'custom' ? draft?.to || '' : '', pulseRange: true };
  if (preset === 'all') next.pulseKeys = (filters.pulseKeys || []).filter(key => key.startsWith('week:'));
  const range = planDateRange(next, now);
  if (range.error) throw new Error(range.error);
  return next;
}
