import test from 'node:test';
import assert from 'node:assert/strict';
import { readSavedPlanCount } from '../../lib/services/action-plan-count.js';
import { readProductRows } from '../../lib/services/product-rows.js';

function fixture(data, fail) {
  const calls = [];
  const db = { from(table) {
    const call = { table }; calls.push(call);
    return {
      select(columns) { call.columns = columns; return this; },
      eq(key, value) { assert.equal(key, 'product_id'); call.product = value; return this; },
      order(key) { assert.equal(key, 'id'); return this; },
      range(from, to) { call.from = from; call.to = to; return this; },
      async abortSignal(signal) {
        call.signal = signal;
        signal?.throwIfAborted();
        if (fail?.table === table) return fail.result;
        return { data: (data[table] || []).filter((row) => row.product_id === call.product).slice(call.from, call.to + 1), error: null };
      },
    };
  } };
  return { db, calls };
}

test('count reader paginates past 500 with scoped, projected, cancellable read-only queries', async () => {
  const { db, calls } = fixture({ manual_actions: Array.from({ length: 501 }, (_, i) => ({ id: String(i), product_id: 'qa', payload: {} })) });
  const signal = new AbortController().signal;
  assert.equal(await readSavedPlanCount(db, 'qa', signal), 501);
  assert.equal(calls.length, 4);
  assert.deepEqual(calls.filter((c) => c.table === 'manual_actions').map((c) => c.from), [0, 500]);
  assert.ok(calls.every((c) => c.product === 'qa' && c.columns !== '*' && c.signal === signal));
});

test('empty count is zero, but an incomplete or failed read is never reported as zero', async () => {
  assert.equal(await readSavedPlanCount(fixture({}).db, 'qa'), 0);
  for (const table of ['manual_actions', 'ads', 'deleted_ads']) {
    for (const result of [{ data: null, error: null }, { data: [], error: { message: 'denied' } }]) {
      await assert.rejects(readSavedPlanCount(fixture({}, { table, result }).db, 'qa'), /read|Incomplete/);
    }
  }
});

test('missing product and aborted requests cannot produce an authoritative count', async () => {
  const { db, calls } = fixture({});
  await assert.rejects(readSavedPlanCount(db, ''), /product is required/);
  assert.equal(calls.length, 0);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(readSavedPlanCount(db, 'qa', controller.signal), { name: 'AbortError' });
});

test('existing product-row callers retain full-row reads by default', async () => {
  const { db, calls } = fixture({ ads: [{ id: 'one', product_id: 'qa', format_name: 'Keep details' }] });
  assert.equal((await readProductRows(db, 'ads', 'qa'))[0].format_name, 'Keep details');
  assert.equal(calls[0].columns, '*');
});
