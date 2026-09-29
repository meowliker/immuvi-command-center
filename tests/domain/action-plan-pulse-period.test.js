import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_PULSE_PRESETS, applyPulsePeriod, pulsePeriodDraft, pulsePeriodLabel } from '../../lib/domain/action-plan-pulse-period.js';
import { PLAN_FILTERS } from '../../lib/domain/action-plan-workspace.js';
import { planDateRange } from '../../lib/domain/action-plan-dates.js';

const now = new Date(2026, 2, 31, 12).getTime();
test('Pulse preset order matches the legacy picker and presets preserve unrelated filters and tiles', () => {
  assert.deepEqual(PLAN_PULSE_PRESETS.map(([key]) => key), ['today', 'yesterday', 'week', '7d', '14d', '30d', 'month', 'lastmonth', 'all']);
  const filters = { ...PLAN_FILTERS, query: 'retained', adType: ['Video'], pulseKeys: ['week:winners'], dateFrom: '2025-01-01', dateTo: '2025-01-02' };
  const copy = structuredClone(filters);
  for (const [key, label] of PLAN_PULSE_PRESETS) {
    const next = applyPulsePeriod(filters, key, null, now);
    assert.equal(next.datePreset, key); assert.equal(next.pulseRange, true); assert.equal(next.dateFrom, ''); assert.equal(next.dateTo, '');
    assert.equal(next.query, filters.query); assert.deepEqual(next.adType, filters.adType); assert.deepEqual(next.pulseKeys, filters.pulseKeys);
    assert.equal(pulsePeriodLabel(next), label); assert.equal(planDateRange(next, now).error, '');
  }
  assert.deepEqual(filters, copy);
});
test('Opening drafts uses local day boundaries and handles month-end without rolling February into March', () => {
  assert.deepEqual(pulsePeriodDraft({ ...PLAN_FILTERS, datePreset: 'custom', dateFrom: '2020-01-01', dateTo: '2020-02-02' }, now), { from: '', to: '' });
  assert.deepEqual(pulsePeriodDraft(applyPulsePeriod(PLAN_FILTERS, 'lastmonth', null, now), now), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(pulsePeriodDraft(applyPulsePeriod(PLAN_FILTERS, 'week', null, now), now), { from: '2026-03-30', to: '2026-03-31' });
  assert.equal(pulsePeriodLabel(PLAN_FILTERS), 'This Week');
});
test('Custom pulse dates validate before commit; reset clears only pulse/date state', () => {
  const filters = { ...PLAN_FILTERS, query: 'retained', status: ['Testing'], dateMode: 'lifetime', pulseKeys: ['week:created'] };
  for (const draft of [{ from: '', to: '' }, { from: '2026-02-30', to: '2026-03-01' }, { from: '2026-03-02', to: '2026-03-01' }]) assert.throws(() => applyPulsePeriod(filters, 'custom', draft, now));
  assert.throws(() => applyPulsePeriod(filters, 'unknown', null, now));
  const next = applyPulsePeriod(filters, 'custom', { from: '2024-02-29', to: '2024-02-29' }, now);
  assert.deepEqual(pulsePeriodDraft(next, now), { from: '2024-02-29', to: '2024-02-29' });
  assert.equal(pulsePeriodLabel(next), '2024-02-29 to 2024-02-29');
  const reset = applyPulsePeriod(next, 'reset', null, now);
  assert.equal(reset.datePreset, 'all'); assert.equal(reset.pulseRange, false); assert.deepEqual(reset.pulseKeys, []);
  assert.equal(reset.dateMode, 'lifetime'); assert.equal(reset.query, 'retained'); assert.deepEqual(reset.status, ['Testing']);
});
