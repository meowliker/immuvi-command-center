module.exports = async (data, input, now) => {
  const { normalizeActionAd, normalizeManualActionRow, resolveActionDisplay } = await import('../../lib/domain/action-plan.js');
  const { planHealth } = await import('../../lib/domain/action-plan-health.js');
  const a = data.ads.find((row) => row.id === input.p_ad_id && row.product_id === input.p_product_id);
  const act = data.manual_actions.find((row) => row.id === input.p_action_id && row.product_id === input.p_product_id);
  const fail = (message) => ({ code: 'P0001', message });
  if (!a || a.updated_at !== input.p_ad_updated_at) return fail('Creative changed. Close and reopen the testing review.');
  if (!act || act.updated_at !== input.p_expected_updated_at) return fail('Action Plan changed. Close and reopen the testing review.');
  const ads = data.ads.map(normalizeActionAd), display = resolveActionDisplay(normalizeManualActionRow(act), ads);
  const age = planHealth([{ display, payload: act.payload }], ads, now).ages.get(act.id);
  if (!['first', 'final'].includes(age.phase)) return fail('Testing review is not due. Refresh the Action Plan.');
  const version = new Date(Math.max(now, Date.parse(a.updated_at) + 1, Date.parse(act.updated_at) + 1)).toISOString();
  if (input.p_decision === 'snooze') {
    if (age.phase !== 'first' || a.testing_defer_count || a.testing_deferred_at) return fail('Testing can only be snoozed once at the first review');
    a.testing_deferred_at = now; a.testing_defer_count = 1;
    a.meta = { ...a.meta, testingDeferredAt: now, testingDeferCount: 1 };
  } else {
    a.status = input.p_decision; a.last_status_change_at = now; a.testing_deferred_at = null; a.testing_defer_count = 0;
    a.meta = { ...a.meta, testingDeferredAt: null, testingDeferCount: 0, _trackerPending: { ...a.meta._trackerPending, status: input.p_decision } };
    act.live_status = input.p_decision; act.payload = { ...act.payload, liveStatus: input.p_decision };
  }
  a.updated_at = version; act.updated_at = version;
  data.activity_events.push({ id: `review-${data.activity_events.length}`, product_id: input.p_product_id, action_id: act.id,
    event_type: input.p_decision === 'snooze' ? 'testing_deferred' : 'status_changed', field_name: 'status', new_value: input.p_decision, created_at: version, source: 'qa-next' });
  return { ad: a, action: act };
};
