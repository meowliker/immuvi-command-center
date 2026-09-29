const assert = require('node:assert/strict');
const trackerRpc = require('./tracker-fixture.cjs');
module.exports = function planCreative(data, input) {
  const action = data.manual_actions.find((row) => row.id === input.p_action_id && row.product_id === input.p_product_id);
  assert.equal(action.updated_at, input.p_expected_updated_at);
  const ad = input.p_ad_id ? data.ads.find((row) => row.id === input.p_ad_id && row.product_id === input.p_product_id) : null;
  if (ad) {
    assert.equal(ad.updated_at, input.p_ad_updated_at);
    assert.equal(action.payload.sourceAdId || action.payload.adId, ad.id);
    trackerRpc(data, 'qa_tracker_save', { ...input, p_expected_updated_at: input.p_ad_updated_at, p_custom: {} });
  }
  for (const [key, value] of Object.entries(input.p_values)) {
    if (key === 'meta') { Object.assign(action.payload, value); continue; }
    const field = { format_name: 'title', ad_type: 'adType', funnel_stage: 'funnelStage', ad_link: 'adLink', drive_link: 'driveLink' }[key] || key;
    action.payload[field] = value;
    if (key === 'angle') action.payload.sourceAngle = value;
    if (key === 'persona') action.payload.sourcePersona = value;
  }
  action.updated_at = new Date(Date.now() + Math.random() * 1000).toISOString();
  return { ad, action };
};
