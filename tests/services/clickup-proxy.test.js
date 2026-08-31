import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildClickUpProxyTarget,
  clickUpForwardHeaders,
  clickUpProxyCorsHeaders,
} from '../../lib/services/clickup-proxy.js';

test('buildClickUpProxyTarget builds v2 ClickUp URLs and preserves extra query params', () => {
  assert.equal(
    buildClickUpProxyTarget('http://localhost/api/clickup?path=/list/901616718146/task&archived=false&page=1'),
    'https://api.clickup.com/api/v2/list/901616718146/task?archived=false&page=1',
  );
});

test('buildClickUpProxyTarget supports v3 only when requested', () => {
  assert.equal(
    buildClickUpProxyTarget('http://localhost/api/clickup?v=3&path=/workspaces/abc'),
    'https://api.clickup.com/api/v3/workspaces/abc',
  );
});

test('buildClickUpProxyTarget rejects missing or relative-unsafe path values', () => {
  assert.throws(() => buildClickUpProxyTarget('http://localhost/api/clickup'), /Missing or invalid/);
  assert.throws(() => buildClickUpProxyTarget('http://localhost/api/clickup?path=list/123'), /Missing or invalid/);
});

test('clickUpForwardHeaders forwards only the user token and JSON headers', () => {
  assert.deepEqual(clickUpForwardHeaders({ authorization: 'pk_test' }), {
    Authorization: 'pk_test',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  });
});

test('clickUpForwardHeaders fails when no browser token is supplied', () => {
  assert.throws(() => clickUpForwardHeaders({}), /Missing Authorization/);
});

test('clickUpProxyCorsHeaders allows browser methods used by the legacy app', () => {
  assert.equal(clickUpProxyCorsHeaders()['Access-Control-Allow-Methods'], 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
});
