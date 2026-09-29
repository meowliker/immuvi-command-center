import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';
import { createLiveQuery } from '../../lib/services/live-query.js';

function fixture() {
  const requests = [];
  const commits = [];
  const busy = [];
  const errors = [];
  const query = createLiveQuery({
    delay: 1,
    load: (signal, options) => new Promise((resolve, reject) => {
      requests.push({ signal, options, resolve: (value) => resolve(() => commits.push(value)), reject });
    }),
    onBusy: (value) => busy.push(value),
    onError: (value) => errors.push(value),
  });
  query.start();
  return { query, requests, commits, busy, errors };
}

test('a slower request cannot overwrite a newer result even if abort is ignored', async () => {
  const { query, requests, commits } = fixture();
  const first = query.refresh();
  const second = query.refresh();
  assert.ok(requests[0].signal.aborted);
  requests[1].resolve('new');
  await second;
  requests[0].resolve('old');
  await first;
  assert.deepEqual(commits, ['new']);
  query.dispose();
});

test('unmounted queries never commit and can restart under Strict Mode', async () => {
  const { query, requests, commits } = fixture();
  const first = query.refresh();
  query.dispose();
  query.start();
  const second = query.refresh();
  requests[0].resolve('old mount');
  requests[1].resolve('new mount');
  await Promise.all([first, second]);
  assert.deepEqual(commits, ['new mount']);
  query.dispose();
});

test('event bursts coalesce and immediately invalidate the older fetch', async () => {
  const { query, requests, commits } = fixture();
  const first = query.refresh();
  for (let index = 0; index < 20; index++) query.invalidate();
  requests[0].resolve('stale');
  await first;
  assert.deepEqual(commits, []);
  await wait(10);
  assert.equal(requests.length, 2);
  requests[1].resolve('current');
  await wait(0);
  assert.deepEqual(commits, ['current']);
  query.dispose();
});

test('reads wait for mutations to finish and only the final snapshot is committed', async () => {
  const { query, requests, commits } = fixture();
  const first = query.refresh();
  query.setPaused(true);
  query.invalidate();
  await query.refresh();
  requests[0].resolve('before save');
  await first;
  assert.equal(requests.length, 1);
  query.setPaused(false);
  await wait(10);
  requests[1].resolve('after save');
  await wait(0);
  assert.deepEqual(commits, ['after save']);
  query.dispose();
});

test('background errors preserve data, then recover without a loading flash', async () => {
  const { query, requests, commits, busy, errors } = fixture();
  const first = query.refresh();
  requests[0].resolve('visible');
  await first;
  busy.length = 0;
  const failure = query.refresh({ background: true });
  requests[1].reject(new Error('Offline'));
  await failure;
  assert.deepEqual(commits, ['visible']);
  assert.equal(errors.at(-1), 'Offline');
  assert.ok(!busy.includes(true));
  const recovery = query.refresh({ background: true });
  requests[2].resolve('updated');
  await recovery;
  assert.equal(errors.at(-1), '');
  query.dispose();
});

test('subscription join refresh still initializes the first-load state', async () => {
  const { query, requests } = fixture();
  const first = query.refresh({ background: true });
  assert.equal(requests[0].options.background, false);
  requests[0].resolve('ready');
  await first;
  query.dispose();
});
