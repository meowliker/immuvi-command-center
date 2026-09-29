import test from 'node:test';
import assert from 'node:assert/strict';
import { taxonomyRequest, validateTaxonomyRequest } from '../../lib/domain/taxonomy-mutations.js';
const id = '00000000-0000-4000-8000-000000000001';
const row = { id: 'a', updatedAt: '2026-09-24T00:00:00Z' };

test('taxonomy request normalizes fields and freezes source versions in deterministic order', () => {
  const result = taxonomyRequest('qa', 'angle', 'save', [row], { name: '1. New /Name', sourceLink: ' https://example.test ', notes: ' Notes ' }, null, id);
  assert.deepEqual(result.p_values, { sources: [{ id: 'a', version: row.updatedAt }], fields: { name: 'New / Name', source_link: 'https://example.test', notes: 'Notes' } });
  assert.equal(row.id, 'a');
});
test('taxonomy rejects empty/unsafe fields and invalid merge selections', () => {
  assert.throws(() => taxonomyRequest('qa', 'angle', 'save', [row], { name: '' }), /Name/);
  assert.throws(() => taxonomyRequest('qa', 'angle', 'save', [row], { name: 'Okay', sourceLink: 'javascript:alert(1)' }), /HTTP/);
  assert.throws(() => taxonomyRequest('qa', 'angle', 'merge', [row], null, row), /Invalid/);
  assert.throws(() => taxonomyRequest('qa', 'angle', 'delete', []), /Invalid/);
  assert.throws(() => taxonomyRequest('qa', 'angle', 'merge', [row, row], null, { id: 'b' }), /Invalid/);
  assert.throws(() => validateTaxonomyRequest({}), /Invalid/);
});
test('archive/restore/delete retain exact null-version preconditions and omit unrelated fields', () => {
  for (const op of ['archive', 'restore', 'delete']) assert.deepEqual(taxonomyRequest('qa', 'persona', op, [{ id: 'p' }], null, null, id).p_values, { sources: [{ id: 'p', version: null }] });
});
test('rename recovery retains a bounded string revision only on saves', () => {
  const request = taxonomyRequest('qa', 'angle', 'save', [row], { name: 'New' });
  request.p_values.renameRevision = 'a'.repeat(32);
  assert.deepEqual(validateTaxonomyRequest(JSON.parse(JSON.stringify(request))), request);
  for (const revision of [null, '', 'a'.repeat(33), ['a'.repeat(32)], 123]) {
    assert.throws(() => validateTaxonomyRequest({ ...request, p_values: { ...request.p_values, renameRevision: revision } }), /Invalid rename/);
  }
  assert.throws(() => validateTaxonomyRequest({ ...request, p_operation: 'archive' }), /Invalid rename/);
});
