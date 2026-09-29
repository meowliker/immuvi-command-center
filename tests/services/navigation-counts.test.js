import test from 'node:test';
import assert from 'node:assert/strict';
import { NAVIGATION_COUNT_TABLES, readNavigationCounts } from '../../lib/services/navigation-counts.js';

function fixture(failure) {
  const calls = [];
  return { calls, db: { from(table) {
    const call = { table }; calls.push(call);
    return {
      select(columns) { call.columns = columns; return this; },
      eq(key, value) { assert.equal(key, 'product_id'); call.product = value; return this; },
      order(key) { assert.equal(key, 'id'); return this; },
      range(from, to) { call.from = from; call.to = to; return this; },
      async abortSignal(signal) {
        call.signal = signal; signal?.throwIfAborted();
        if (failure?.table === table) return failure.result;
        const data = table === 'inspirations' ? Array.from({ length: 501 }, (_, i) => ({ id: String(i), product_id: 'qa' })) : [];
        return { data: data.slice(call.from, call.to + 1), error: null };
      },
    };
  } } };
}

test('navigation reads are scoped, projected, abortable and fully paginated', async () => {
  const { db, calls } = fixture();
  const signal = new AbortController().signal;
  assert.equal((await readNavigationCounts(db, 'qa', signal)).inspiration, 501);
  assert.equal(calls.length, NAVIGATION_COUNT_TABLES.length + 1);
  assert.deepEqual(calls.filter((c) => c.table === 'inspirations').map((c) => c.from), [0, 500]);
  assert.ok(calls.every((c) => c.product === 'qa' && c.columns !== '*' && c.signal === signal));
});

test('incomplete or denied tables cannot be presented as zero counts', async () => {
  for (const table of NAVIGATION_COUNT_TABLES) {
    for (const result of [{ data: null, error: null }, { data: [], error: { message: 'denied' } }]) {
      await assert.rejects(readNavigationCounts(fixture({ table, result }).db, 'qa'), /read|Incomplete/);
    }
  }
});

test('missing product and cancellation refuse a count result', async () => {
  const { db, calls } = fixture();
  await assert.rejects(readNavigationCounts(db, ''), /product is required/);
  assert.equal(calls.length, 0);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(readNavigationCounts(db, 'qa', controller.signal), { name: 'AbortError' });
});
