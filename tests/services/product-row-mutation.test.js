import test from 'node:test';
import assert from 'node:assert/strict';
import { patchProductRow } from '../../lib/services/product-row-mutation.js';

function fixture(initial, afterRead = () => {}) {
  let row = structuredClone(initial);
  let updates = 0;
  const client = {
    from() {
      const filters = [];
      let patch;
      return {
        select() { return this; },
        eq(key, value) { filters.push([key, value]); return this; },
        is(key, value) { filters.push([key, value]); return this; },
        update(value) { patch = value; return this; },
        async maybeSingle() {
          const matches = row && filters.every(([key, value]) => row[key] === value);
          if (!patch) {
            const result = matches ? structuredClone(row) : null;
            afterRead(row);
            return { data: result, error: null };
          }
          updates++;
          if (!matches) return { data: null, error: null };
          row = { ...row, ...patch };
          return { data: row, error: null };
        },
      };
    },
  };
  return { client, row: () => row, updates: () => updates };
}

test('mutations merge against fresh JSON and retain unrelated remote edits', async () => {
  const { client } = fixture({ id: 'a', product_id: 'p1', updated_at: 'version1', payload: { newRemoteField: 'keep', status: 'Approved' } });
  const row = await patchProductRow(client, 'manual_actions', 'p1', 'a', (current) => ({ payload: { ...current.payload, dueDate: '2026-10-01' } }));
  assert.deepEqual(row.payload, { newRemoteField: 'keep', status: 'Approved', dueDate: '2026-10-01' });
});

test('a concurrent update is rejected rather than overwritten', async () => {
  const { client, row } = fixture({ id: 'a', product_id: 'p1', updated_at: 'version1', meta: {} }, (current) => { current.updated_at = 'version2'; });
  await assert.rejects(patchProductRow(client, 'ads', 'p1', 'a', () => ({ meta: { stale: true } })), /changed while you were saving/);
  assert.deepEqual(row().meta, {});
});

test('deleted and foreign-product rows cannot be mutated or resurrected', async () => {
  for (const initial of [null, { id: 'a', product_id: 'p2' }, { id: 'a', product_id: 'p1', deleted_at: 'deleted' }]) {
    const { client, updates } = fixture(initial);
    await assert.rejects(patchProductRow(client, 'ads', 'p1', 'a', () => ({ status: 'Winner' })), /no longer available/);
    assert.equal(updates(), 0);
  }
});

test('legacy rows with null timestamps use an explicit null precondition', async () => {
  const { client } = fixture({ id: 'cell', product_id: 'p1', updated_at: null, creative_assignments: ['remote-ad'] });
  const row = await patchProductRow(client, 'matrix_cells', 'p1', 'cell', (current) => ({ creative_assignments: [...current.creative_assignments, 'local-ad'] }));
  assert.deepEqual(row.creative_assignments, ['remote-ad', 'local-ad']);
});
