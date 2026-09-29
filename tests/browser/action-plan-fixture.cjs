const creation = require('./creation-fixture.cjs');
module.exports = function planBatch(data, input) {
  for (const item of input.p_items) {
    const action = data.manual_actions.find((a) => a.id === item.id && a.product_id === input.p_product_id);
    if (!action || action.updated_at !== item.updated_at) throw new Error('Stale browser batch fixture');
  }
  return input.p_items.map((item) => {
    const action = data.manual_actions.find((a) => a.id === item.id);
    if (input.p_operation === 'remove') {
      data.manual_actions = data.manual_actions.filter((a) => a.id !== item.id);
      data.activity_events.push({ id: `removed-${item.id}`, product_id: input.p_product_id, action_id: item.id, event_type: 'removed_from_plan', source: 'qa-next', created_at: new Date().toISOString(), metadata: { linked_ad_id: action.payload.sourceAdId || action.payload.adId } });
      return { id: item.id, removed: true };
    }
    if (!item.ad_id) {
      const stamp = new Date().toISOString();
      if (input.p_operation === 'status') { action.live_status = input.p_value; Object.assign(action.payload, { liveStatus: input.p_value, _statusChangedAt: Date.now() }); }
      else Object.assign(action.payload, { dueDate: input.p_value, _dueDateMs: input.p_value ? Date.parse(`${input.p_value}T23:59:59Z`) : null });
      action.updated_at = stamp;
      data.activity_events.push({ id: `standalone-${data.activity_events.length}`, product_id: input.p_product_id, action_id: item.id, event_type: input.p_operation === 'status' ? 'status_changed' : 'due_changed', created_at: stamp, source: 'qa-next' });
      return { id: item.id, action };
    }
    const result = creation.edit(data, { p_product_id: input.p_product_id, p_action_id: item.id, p_ad_id: item.ad_id, p_expected_updated_at: item.updated_at, p_ad_updated_at: item.ad_updated_at,
      p_status: input.p_operation === 'status' ? input.p_value : null, p_due_date: input.p_operation === 'due' ? input.p_value : null });
    return { id: item.id, ...result };
  });
};
