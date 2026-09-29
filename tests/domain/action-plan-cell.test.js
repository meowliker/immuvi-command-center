import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveActionDisplay } from '../../lib/domain/action-plan.js';

const display = (action = {}, ad = {}) => resolveActionDisplay({ sourceAdId: 'AD', ...action }, [{ id: 'AD', ...ad }]);
test('cell identity preserves action and canonical creative fields before legacy fallbacks', () => {
  const action = { sourceAngle: 'Snapshot', _customFields: { 'persona tag': 'Custom' } };
  const ad = { angle: 'Live', persona: 'Live persona', description: '| Angle | Description |' };
  assert.equal(display(action, ad).angle, 'Snapshot'); assert.equal(display(action, ad).persona, 'Live persona');
  assert.equal(display({}, ad).angle, 'Live'); assert.equal(action._customFields['persona tag'], 'Custom');
});
test('cell identity recovers custom-field mirrors and markdown without inventing missing coordinates', () => {
  assert.equal(display({}, { _customFields: { 'Angle Tag': 'Recovery' } }).angle, 'Recovery');
  const row = display({ description: '| Field | Value |\n| --- | --- |\n| **Angle** | **Energy** |\n| Persona Tag | Busy<br>parents |' });
  assert.equal(row.angle, 'Energy'); assert.equal(row.persona, 'Busy parents');
  assert.equal(display({ description: '| Angle | - |\n| Persona | --- |' }).angle, '');
  assert.equal(display({ description: 'Angle of attack is unrelated prose' }).angle, '');
});
test('cell identity recovers sparse ClickUp table embeds and labeled description lines', () => {
  const row = display({}, { description: '[table-embed:1:1 Field | 1:2 Value | 2:1 Angle | 2:2 Calm | 7:1 Persona | 7:2 Parents |]' });
  assert.equal(row.angle, 'Calm'); assert.equal(row.persona, 'Parents');
  assert.equal(display({ description: '- Ad Angle: Focus\nAudience: Students' }).persona, 'Students');
  assert.equal(display({ description: '[table-embed:broken]' }).angle, '');
});
test('linked ClickUp edits and explicit clears override stale Action Plan snapshots', () => {
  const action = { sourceAngle: 'Old angle', sourcePersona: 'Old persona' };
  const ad = { _clickupListId: '1301130000002447', angle: 'New angle', persona: '', _customFields: { 'angle tag': 'New angle', 'persona tag': '' } };
  assert.equal(display(action, ad).angle, 'New angle');
  assert.equal(display(action, ad).persona, '');
  assert.equal(display(action, { ...ad, _trackerPending: { angle: '' } }).angle, '');
});
