import test from 'node:test';
import assert from 'node:assert/strict';
import { readProductRows } from '../../lib/services/product-rows.js';
test('inspiration and queue reads page beyond 500 with a product filter and stable ordering', async () => {
  for (const table of ['inspirations', 'inspiration_queue']) {
    const calls = [], data = Array.from({ length: 501 }, (_, id) => ({ id, product_id: 'qa' }));
    const db = { from(name) { const call = { table: name }; calls.push(call); return { select() { return this; }, eq(key, value) { call.filter = [key, value]; return this; }, order(key) { call.order = key; return this; }, range(from, to) { call.range = [from, to]; return this; }, async abortSignal() { return { data: data.slice(call.range[0], call.range[1] + 1) }; } }; } };
    assert.equal((await readProductRows(db, table, 'qa', new AbortController().signal)).length, 501);
    assert.deepEqual(calls.map((c) => c.range), [[0, 499], [500, 999]]);
    for (const call of calls) { assert.deepEqual(call.filter, ['product_id', 'qa']); assert.equal(call.order, 'id'); }
  }
});
test('partial or failed inspiration pages are not accepted as an empty successful library', async () => {
  for (const response of [{ data: null }, { error: { message: 'denied' } }]) {
    const query = { select() { return this; }, eq() { return this; }, order() { return this; }, range() { return this; }, async abortSignal() { return response; } };
    await assert.rejects(readProductRows({ from: () => query }, 'inspirations', 'qa', new AbortController().signal), /inspirations/);
  }
});
