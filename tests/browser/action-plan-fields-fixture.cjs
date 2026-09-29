module.exports = function planFields(data, input) {
  const action = data.manual_actions.find((a) => a.id === input.p_action_id && a.product_id === input.p_product_id);
  const ad = data.ads.find((a) => a.id === input.p_ad_id && a.product_id === input.p_product_id);
  if (!action || !ad || action.updated_at !== input.p_expected_updated_at || ad.updated_at !== input.p_ad_updated_at) return { code: 'P0001', message: 'Creative changed. Reopen assignments before saving.' };
  for (const [id, field] of Object.entries(input.p_custom)) {
    (ad.meta._customFieldsRaw ||= {})[field.name.toLowerCase()] = field.value;
    (ad.meta._customFields ||= {})[field.name.toLowerCase()] = field.display;
    if (id === '__task_assignees') { ad.meta.assignees = field.value.map((id) => ({ id })); action.payload.assignees = ad.meta.assignees; }
    if (ad.clickup_task_id) (ad.meta._trackerPending ||= {})[`custom:${id}`] = field.value;
    data.activity_events.push({ id: `field-${data.activity_events.length}`, product_id: input.p_product_id, action_id: action.id, event_type: 'assignment_changed', field_name: field.name, new_value: JSON.stringify(field.value), created_at: new Date().toISOString(), source: 'qa-next' });
  }
  ad.updated_at = new Date(Date.now() + Math.random() * 1000).toISOString(); action.updated_at = ad.updated_at;
  return { ad, action };
};
