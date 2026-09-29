import test from 'node:test';
import assert from 'node:assert/strict';
import { sameData, reconcileRows, reconcileDrafts } from '../../lib/domain/live-data.js';

test('semantic equality ignores object key order but preserves array order', () => {
  assert.ok(sameData({ a: 1, b: [2, 3] }, { b: [2, 3], a: 1 }));
  assert.equal(sameData([1, 2], [2, 1]), false);
  assert.equal(sameData({ a: undefined }, {}), false);
  assert.equal(sameData(null, {}), false);
});

test('unchanged snapshots retain the array and row references', () => {
  const before = [{ id: 'ad-1', meta: { angle: 'Energy' } }];
  assert.equal(reconcileRows(before, structuredClone(before)), before);
});

test('changed snapshots retain only unchanged rows, obey deletion and ordering', () => {
  const before = [{ id: 'a', status: 'Testing' }, { id: 'b' }, { id: 'deleted' }];
  const after = reconcileRows(before, [{ id: 'b' }, { id: 'a', status: 'Winner' }, { id: 'new' }]);
  assert.equal(after[0], before[1]);
  assert.notEqual(after[1], before[0]);
  assert.deepEqual(after.map((row) => row.id), ['b', 'a', 'new']);
});

test('action and worker identities can use their own stable keys', () => {
  const rows = [{ display: { dbId: 'a' } }, { display: { dbId: 'b' } }];
  assert.equal(reconcileRows(rows, structuredClone(rows), (row) => row.display.dbId), rows);
});

test('draft rebase preserves edited fields and adopts unrelated remote edits', () => {
  const before = [{ id: 'a', name: 'Energy', notes: 'Old', sourceLink: '' }];
  const drafts = { a: { ...before[0], notes: 'Unsaved local text' } };
  const incoming = [{ ...before[0], name: 'New Energy', sourceLink: 'https://example.test' }];
  assert.deepEqual(reconcileDrafts(drafts, before, incoming, ['name', 'notes', 'sourceLink']), {
    a: { ...incoming[0], notes: 'Unsaved local text' },
  });
});

test('draft rebase drops deleted rows and leaves unchanged drafts stable', () => {
  const before = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
  const drafts = Object.fromEntries(before.map((row) => [row.id, row]));
  assert.equal(reconcileDrafts(drafts, before, structuredClone(before), ['name']), drafts);
  assert.deepEqual(Object.keys(reconcileDrafts(drafts, before, [before[1]], ['name'])), ['b']);
});
