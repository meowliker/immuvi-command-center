import test from 'node:test';
import assert from 'node:assert/strict';

import { clickUpListScopedKey, hasListScopedValue, parseClickUpListId } from '../../lib/domain/clickup.js';

test('parseClickUpListId extracts the list id from a ClickUp list URL', () => {
  assert.equal(
    parseClickUpListId('https://app.clickup.com/9016762494/v/li/901616718146'),
    '901616718146',
  );
});

test('parseClickUpListId accepts a raw list id', () => {
  assert.equal(parseClickUpListId(' 901616718146 '), '901616718146');
});

test('parseClickUpListId prefers the list id over the workspace id', () => {
  assert.equal(
    parseClickUpListId('https://app.clickup.com/9016762494/v/list/901615425547?view=abc'),
    '901615425547',
  );
});

test('list-scoped cache keys isolate statuses and field maps by list id', () => {
  const statusKey = clickUpListScopedKey('901616718146', 'statuses');
  const fieldKey = clickUpListScopedKey('901616718146', 'fields');
  const otherStatusKey = clickUpListScopedKey('901615425547', 'statuses');
  const cache = { [statusKey]: ['untested'], [fieldKey]: { editor: 'cf1' } };

  assert.equal(statusKey, 'statuses:901616718146');
  assert.notEqual(statusKey, otherStatusKey);
  assert.equal(hasListScopedValue(cache, '901616718146', 'statuses'), true);
  assert.equal(hasListScopedValue(cache, '901615425547', 'statuses'), false);
});
