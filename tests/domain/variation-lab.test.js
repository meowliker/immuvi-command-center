import test from 'node:test';
import assert from 'node:assert/strict';
import { VARIATION_TEMPLATES, canSpawnVariations, variationAxes, variationRows } from '../../lib/domain/variation-lab.js';

test('Variation Lab templates match legacy presets and custom axes are sanitized', () => {
  assert.deepEqual(VARIATION_TEMPLATES.map(({ axis, count }) => [axis, count]), [['Hook', 5], ['Production Style', 3], ['Music', 4], ['CTA', 3], ['Full Remake', 3]]);
  assert.deepEqual(variationAxes({ invalid: true }), variationAxes([]));
  const axes = variationAxes([' Hook ', ' Color ', 'Color', null, {}, '', 'x'.repeat(81)]);
  assert.equal(axes.filter((axis) => axis === 'Hook').length, 1);
  assert.equal(axes.filter((axis) => axis === 'Color').length, 1);
  assert.equal(axes.includes('x'.repeat(81)), false);
});
test('Variation Lab eligibility excludes removed and quarantined creatives', () => {
  for (const status of ['Winner', 'Mild Winner', 'Scale']) assert.equal(canSpawnVariations({ status }), true);
  for (const creative of [null, {}, { status: 'Testing' }, { status: 'Winner', deletedAt: 'date' }, { status: 'Winner', _productBoundaryQuarantined: true }, { status: 'Winner', productBoundaryQuarantined: true }]) assert.equal(canSpawnVariations(creative), false);
});
test('Variation rows inherit defaults, preserve explicit overrides, and keep single-note payloads clean', () => {
  const defaults = { dueDate: '2026-09-30', editorIds: ['12'], reviewerIds: ['13'] };
  const drafts = [{ axis: 'Hook', mode: 'note', from: 'New hook', to: 'Draft retained only', brief: 'Brief', hypothesis: 'Hypothesis' },
    { axis: '__custom__', customAxis: ' Color ', mode: 'split', from: 'Red', to: 'Green', dueDate: '2026-10-01', editorIds: ['14', '14'], reviewerIds: [] }];
  const copy = structuredClone(drafts), result = variationRows(drafts, defaults);
  assert.deepEqual(result[0], { axis: 'Hook', from: 'New hook', to: '', brief: 'Brief', hypothesis: 'Hypothesis', dueDate: defaults.dueDate, editorIds: ['12'], reviewerIds: ['13'] });
  assert.equal(result[1].axis, 'Color'); assert.equal(result[1].to, 'Green'); assert.equal(result[1].dueDate, '2026-10-01');
  assert.deepEqual(result[1].editorIds, ['14']); assert.deepEqual(result[1].reviewerIds, ['13']);
  assert.deepEqual(drafts, copy);
});
test('Invalid variation batches fail before any mutation', () => {
  for (const rows of [null, [], Array.from({ length: 21 }, () => ({ axis: 'Hook' })), [null], [{ axis: '__custom__' }], [{ axis: 'x'.repeat(81) }],
    [{ axis: 'Hook', dueDate: '2026-02-30' }], [{ axis: 'Hook', dueDate: 'not a date' }], [{ axis: 'Hook', editorIds: [0] }], [{ axis: 'Hook', reviewerIds: {} }]]) {
    assert.throws(() => variationRows(rows, {}));
  }
  assert.equal(variationRows(Array.from({ length: 20 }, () => ({ axis: 'Hook' })), {}).length, 20);
});
