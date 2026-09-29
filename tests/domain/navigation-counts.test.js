import test from 'node:test';
import assert from 'node:assert/strict';
import { navigationCounts } from '../../lib/domain/navigation-counts.js';

const row = (id, values = {}) => ({ id, product_id: 'qa', ...values });
test('legacy badge totals, ratios and saved action/production parity are product scoped', () => {
  const data = {
    angles: [row('a'), row('archived', { archived_at: 'yesterday' }), row('foreign', { product_id: 'other' })],
    personas: [row('p'), row('p2')],
    ads: [row('one', { angle: 'A', persona: 'P' }), row('two', { angle: 'A', persona: 'P' }),
      row('child', { angle: 'B', persona: 'P', parent_ad_id: 'one' }), row('three', { meta: { angle: 'B', persona: 'P' } }),
      row('foreign', { product_id: 'other' })],
    competitor_brands: [row('approved', { approved: true }), row('pending', { approved: false })],
    manual_actions: [row('saved'), row('foreign', { product_id: 'other' })],
    inspirations: [row('i'), row('i2'), row('foreign', { product_id: 'other' })],
  };
  const before = structuredClone(data);
  assert.deepEqual(navigationCounts(data, 'qa'), { angles: 2, personas: 2, competitors: '1/2',
    'creative-tracker': 4, 'creative-matrix': '2/4', 'action-plan': 1, production: 1, inspiration: 2 });
  assert.deepEqual(data, before);
});

test('deletion, quarantine and task-identity tombstones do not inflate badges', () => {
  const data = {
    ads: [row('ok', { angle: 'A', persona: 'P' }), row('deleted', { deleted_at: 'now' }),
      row('quarantined', { meta: { _productBoundaryQuarantined: true } }), row('stale', { clickup_task_id: 'task' })],
    deleted_ads: [row('tombstone', { clickup_task_id: 'task' })],
    manual_actions: [row('saved', { payload: { adId: 'ok' } }), row('blocked', { payload: { adId: 'stale', clickupTaskId: 'task' } }),
      row('quarantined', { payload: { _productBoundaryQuarantined: true } })],
  };
  const result = navigationCounts(data, 'qa');
  assert.equal(result['creative-tracker'], 1);
  assert.equal(result['action-plan'], 1);
  assert.equal(result.production, 1);
});

test('empty product and empty tables show zero totals and zero ratios', () => {
  const empty = { angles: 0, personas: 0, competitors: '0/0', 'creative-tracker': 0,
    'creative-matrix': '0/0', 'action-plan': 0, production: 0, inspiration: 0 };
  assert.deepEqual(navigationCounts({}, 'qa'), empty);
  assert.deepEqual(navigationCounts({ ads: [row('one')] }, ''), empty);
});
