import test from 'node:test';
import assert from 'node:assert/strict';
import { productFieldCatalog, productAdminRequest, validateFieldCatalog } from '../../lib/domain/product-administration.js';
import { commandHqSnapshot } from '../../lib/domain/command-hq.js';
const catalog = { creativeStructure: [{ name: 'Custom', desc: 'Example' }], hookType: [], productionStyle: [] };
test('product field catalogs preserve explicit empty lists and isolate defaults and caller state', () => {
  assert.equal(productFieldCatalog().creativeStructure[0].name, 'UGC');
  const result = productFieldCatalog({ field_options: catalog });
  assert.deepEqual(result, catalog); result.creativeStructure[0].name = 'Mutated';
  assert.equal(catalog.creativeStructure[0].name, 'Custom');
  assert.deepEqual(validateFieldCatalog(catalog), catalog);
  assert.deepEqual(productFieldCatalog({ field_options: { hookType: [null, 'bad', { name: 'Valid', desc: 'Keep' }] } }).hookType, [{ name: 'Valid', desc: 'Keep' }]);
  assert.throws(() => validateFieldCatalog({ ...catalog, hookType: [{ name: 'X', desc: '' }, { name: 'x', desc: '' }] }), /Duplicate/);
  assert.throws(() => validateFieldCatalog({ ...catalog, hookType: [{ name: ' ', desc: '' }] }), /name/);
});
test('product requests freeze values and require valid identity, preview and confirmation', () => {
  const created = productAdminRequest('create', null, { name: 'Test', color: '#119944' });
  assert.equal(created.p_product_id, `qa-prod-${created.p_request_id}`);
  const fields = productAdminRequest('fields', { id: 'P', updated_at: '2026-09-24T00:00:00Z' }, { catalog });
  assert.notEqual(fields.p_values.catalog, catalog);
  assert.throws(() => productAdminRequest('delete', { id: 'P' }, { confirmName: 'Test' }), /Preview/);
  assert.throws(() => productAdminRequest('unlink', { id: 'P' }, {}), /Confirm/);
});
test('HQ uses product field options but retains used values removed from the catalog', () => {
  const result = commandHqSnapshot({ productId: 'P', fieldOptions: catalog, ads: [{ id: 'A', product_id: 'P', meta: { creativeStructure: 'Older value' } }] });
  assert.deepEqual(result.coverage[2].items.map((item) => item.name), ['Custom', 'Older value']);
  assert.equal(result.coverage[3].total, 0);
});
