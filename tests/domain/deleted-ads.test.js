import test from 'node:test';
import assert from 'node:assert/strict';

import { adIdentifiers, isDeletedAd, isTombstonedAd } from '../../lib/domain/deleted-ads.js';

test('isDeletedAd treats soft-deleted database and view rows as deleted', () => {
  assert.equal(isDeletedAd({ deleted_at: '2026-08-31T10:00:00.000Z' }), true);
  assert.equal(isDeletedAd({ deletedAt: '2026-08-31T10:00:00.000Z' }), true);
  assert.equal(isDeletedAd({ deleted_at: null, deletedAt: null }), false);
});

test('adIdentifiers includes local and ClickUp ids used by tombstones', () => {
  assert.deepEqual(adIdentifiers({
    id: 'AD-101',
    _clickupId: '86d3z5ta9',
    clickupTaskId: '',
    clickup_task_id: '86d2qa5bm',
  }), ['AD-101', '86d3z5ta9', '86d2qa5bm']);
});

test('isTombstonedAd respects both soft deletes and durable tombstone ids', () => {
  assert.equal(isTombstonedAd({ id: 'AD-101' }, new Set(['AD-101'])), true);
  assert.equal(isTombstonedAd({ _clickupId: '86d3z5ta9' }, ['86d3z5ta9']), true);
  assert.equal(isTombstonedAd({ id: 'AD-102' }, ['AD-101']), false);
});
