import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mergeProductConfig,
  normalizeProductConfig,
  productClickUpListId,
  productClickUpListName,
  productRowToView,
} from '../../lib/domain/product-config.js';

test('normalizes legacy camelCase ClickUp config keys to database keys', () => {
  assert.deepEqual(normalizeProductConfig({ clickupListId: '123', clickupListName: 'QA List' }), {
    clickup_list_id: '123',
    clickup_list_name: 'QA List',
  });
});

test('reads product ClickUp list settings from top-level fields first', () => {
  const product = {
    clickupListId: '901616718146',
    clickupListName: 'Immuvi QA Test List',
    config: { clickup_list_id: 'older', clickup_list_name: 'Older List' },
  };

  assert.equal(productClickUpListId(product), '901616718146');
  assert.equal(productClickUpListName(product), 'Immuvi QA Test List');
});

test('reads product ClickUp list settings from config fallback', () => {
  const product = {
    config: { clickup_list_id: '901616718146', clickup_list_name: 'Immuvi QA Test List' },
  };

  assert.equal(productClickUpListId(product), '901616718146');
  assert.equal(productClickUpListName(product), 'Immuvi QA Test List');
});

test('mergeProductConfig preserves existing keys when incoming update omits them', () => {
  const merged = mergeProductConfig(
    {
      clickup_list_id: '901616718146',
      clickup_list_name: 'Immuvi QA Test List',
      tracker_saved_views: [{ id: 'mine' }],
      tracker_active_view_by_user: { user: 'mine' },
      production: { stages: ['review'] },
      doc_id: 'doc-1',
      ins_prefix: 'IM-INS',
    },
    { theme: 'dark', clickup_list_id: undefined },
  );

  assert.equal(merged.clickup_list_id, '901616718146');
  assert.equal(merged.clickup_list_name, 'Immuvi QA Test List');
  assert.deepEqual(merged.tracker_saved_views, [{ id: 'mine' }]);
  assert.deepEqual(merged.tracker_active_view_by_user, { user: 'mine' });
  assert.deepEqual(merged.production, { stages: ['review'] });
  assert.equal(merged.doc_id, 'doc-1');
  assert.equal(merged.ins_prefix, 'IM-INS');
  assert.equal(merged.theme, 'dark');
});

test('mergeProductConfig allows explicit clearing or replacement', () => {
  const merged = mergeProductConfig(
    { clickup_list_id: '901616718146', clickup_list_name: 'Immuvi QA Test List' },
    { clickup_list_id: '', clickup_list_name: 'New Name' },
  );

  assert.equal(merged.clickup_list_id, '');
  assert.equal(merged.clickup_list_name, 'New Name');
});

test('productRowToView mirrors legacy row conversion shape', () => {
  const product = productRowToView({
    id: 'immuvi',
    name: 'Immuvi',
    config: '{"clickup_list_id":"901616718146","clickup_list_name":"Immuvi QA Test List"}',
  });

  assert.equal(product.clickupListId, '901616718146');
  assert.equal(product.clickupListName, 'Immuvi QA Test List');
});
