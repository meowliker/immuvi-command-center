import test from 'node:test';
import assert from 'node:assert/strict';
import { getLiveSync } from '../../lib/services/live-sync.js';

function fixture() {
  const channels = [];
  const removed = [];
  const client = {
    supabaseUrl: 'https://qa.example.test',
    channel(name) {
      const channel = {
        name, handlers: [],
        on(type, filter, handler) { this.handlers.push({ type, filter, handler }); return this; },
        subscribe(callback) { this.status = callback; return this; },
        emit(eventType, row) {
          for (const { filter, handler } of this.handlers) if (filter.event === eventType) handler({ eventType, new: row, old: row });
        },
      };
      channels.push(channel);
      return channel;
    },
    removeChannel(channel) { removed.push(channel); },
  };
  return { sync: getLiveSync(client), client, channels, removed };
}

test('subscriptions are shared per client, table and product, then removed on last cleanup', () => {
  const { sync, client, channels, removed } = fixture();
  assert.equal(getLiveSync(client), sync);
  const one = sync.watch({ productId: 'p1', tables: ['ads'], invalidate() {}, pause() {} });
  const two = sync.watch({ productId: 'p1', tables: ['ads'], invalidate() {}, pause() {} });
  assert.equal(channels.length, 1);
  one();
  assert.equal(removed.length, 0);
  two();
  assert.equal(removed.length, 1);
});

test('reconnect catches missed events and irrelevant products are ignored', () => {
  const { sync, channels } = fixture();
  let updates = 0;
  const stop = sync.watch({ productId: 'p1', tables: ['ads'], invalidate() { updates++; }, pause() {} });
  const channel = channels[0];
  channel.status('SUBSCRIBED');
  channel.emit('UPDATE', { id: 'other', product_id: 'p2' });
  assert.equal(updates, 1);
  channel.emit('UPDATE', { id: 'ours', product_id: 'p1' });
  assert.equal(updates, 2);
  assert.equal(channel.handlers[0].filter.filter, 'product_id=eq.p1');
  stop();
});

test('primary-key-only deletes invalidate a scoped read without requiring product metadata', () => {
  const { sync, channels } = fixture();
  let updates = 0;
  const stop = sync.watch({ productId: 'p1', tables: ['ads'], invalidate() { updates++; }, pause() {} });
  assert.equal(channels[0].handlers.find(({ filter }) => filter.event === 'DELETE').filter.filter, undefined);
  channels[0].emit('DELETE', { id: 'gone' });
  assert.equal(updates, 1);
  stop();
});

test('database-ready acknowledgment refreshes again after the socket join', () => {
  const { sync, channels } = fixture();
  let updates = 0;
  const stop = sync.watch({ productId: 'p1', tables: ['ads'], invalidate() { updates++; }, pause() {} });
  channels[0].status('SUBSCRIBED');
  channels[0].handlers.find(({ type }) => type === 'system').handler({ status: 'ok' });
  assert.equal(updates, 2);
  stop();
});

test('global tables share subscriptions across product views', () => {
  const { sync, channels } = fixture();
  const one = sync.watch({ productId: 'p1', tables: ['worker_registry'], invalidate() {}, pause() {} });
  const two = sync.watch({ productId: 'p2', tables: ['worker_registry'], invalidate() {}, pause() {} });
  assert.equal(channels.length, 1);
  assert.ok(channels[0].handlers.every(({ filter }) => !filter.filter));
  one(); two();
});

test('brief queues and image worker events do not filter on nonexistent product_id columns',()=>{
  const {sync,channels}=fixture();
  let updates=0;
  const stop=sync.watch({productId:'p1',tables:['variation_brief_queue','qa_image_worker'],invalidate(){updates++;},pause(){}});
  for(const channel of channels){assert.ok(channel.handlers.every(({filter})=>!filter.filter));channel.emit('UPDATE',{id:'job'});}
  assert.equal(updates,2);stop();
});

test('writes pause related reads, block overlap, and invalidate other tabs after completion', () => {
  const { sync } = fixture();
  const paused = [];
  let updates = 0;
  const stop = sync.watch({ productId: 'p1', tables: ['ads'], invalidate() { updates++; }, pause(value) { paused.push(value); } });
  const finish = sync.beginWrite('p1');
  assert.equal(sync.beginWrite('p1'), null);
  assert.equal(sync.beginWrite(''), null);
  const finishOther = sync.beginWrite('p2');
  assert.equal(typeof finishOther, 'function');
  finishOther();
  finish();
  assert.deepEqual(paused, [false, true, true, true, false]);
  assert.equal(updates, 1);
  stop();
});

test('a view mounted during a pending save waits even when the previous view unmounted', () => {
  const { sync } = fixture();
  const finish = sync.beginWrite('p1');
  const paused = [];
  const stop = sync.watch({ productId: 'p1', tables: ['manual_actions'], invalidate() {}, pause(value) { paused.push(value); } });
  assert.deepEqual(paused, [true]);
  finish();
  assert.deepEqual(paused, [true, false]);
  stop();
});

test('edits wait behind a short commit in order instead of being rejected', async () => {
  const { sync } = fixture();
  const finishImport = sync.beginWrite('p1');
  const first = sync.acquireWrite('p1');
  const second = sync.acquireWrite('p1');
  finishImport();
  const finishFirst = await first;
  assert.equal(sync.beginWrite('p1'), null);
  assert.equal(sync.isWriting('p1'), true);
  finishFirst();
  const finishSecond = await second;
  assert.equal(sync.isWriting('p1'), true);
  finishSecond();
  assert.equal(sync.isWriting('p1'), false);
});

test('unmounted queued edits are cancelled and cannot save in a different product', async () => {
  const { sync } = fixture();
  const finish = sync.beginWrite('p1');
  const request = new AbortController();
  const pending = sync.acquireWrite('p1', request.signal);
  request.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  finish();
  assert.equal(sync.isWriting('p1'), false);
});

test('global queued writes prevent later product writes from jumping the queue', async () => {
  const { sync } = fixture();
  const finish = sync.beginWrite('p1');
  const global = sync.acquireWrite('');
  assert.equal(sync.beginWrite('p2'), null);
  finish();
  const finishGlobal = await global;
  assert.equal(sync.beginWrite('p2'), null);
  finishGlobal();
  const finishOther = sync.beginWrite('p2');
  assert.equal(typeof finishOther, 'function');
  finishOther();
});
