import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSupabaseApiUrl,
  postgrestIn,
  requireSupabaseServiceConfig,
  supabaseRestRequest,
  supabaseServiceHeaders,
} from '../../lib/services/supabase-rest.js';

test('requireSupabaseServiceConfig reads and trims service env', () => {
  assert.deepEqual(
    requireSupabaseServiceConfig({
      SUPABASE_URL: 'https://example.supabase.co/',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    }),
    { url: 'https://example.supabase.co', serviceKey: 'service-key' },
  );
});

test('requireSupabaseServiceConfig fails closed when secrets are absent', () => {
  assert.throws(() => requireSupabaseServiceConfig({}), /missing SUPABASE_URL/);
});

test('supabaseServiceHeaders keeps service role in server-only headers', () => {
  assert.deepEqual(supabaseServiceHeaders('service-key', { Prefer: 'return=minimal' }), {
    apikey: 'service-key',
    Authorization: 'Bearer service-key',
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  });
});

test('buildSupabaseApiUrl normalizes slashes', () => {
  assert.equal(
    buildSupabaseApiUrl('https://example.supabase.co/', '/rest/v1/', '/products?select=id'),
    'https://example.supabase.co/rest/v1/products?select=id',
  );
});

test('postgrestIn quotes ids safely for in filters', () => {
  assert.equal(postgrestIn(['AD-101', 'task"quoted', 'slash\\id']), '"AD-101","task\\"quoted","slash\\\\id"');
});

test('supabaseRestRequest sends JSON and parses JSON responses', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify([{ id: 'immuvi' }]), { status: 200 });
  };

  const rows = await supabaseRestRequest('PATCH', '/products?id=eq.immuvi', { name: 'Immuvi' }, {
    env: {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    },
    fetchImpl,
    prefer: 'return=representation',
  });

  assert.deepEqual(rows, [{ id: 'immuvi' }]);
  assert.equal(calls[0].url, 'https://example.supabase.co/rest/v1/products?id=eq.immuvi');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer service-key');
  assert.equal(calls[0].init.headers.Prefer, 'return=representation');
  assert.equal(calls[0].init.body, '{"name":"Immuvi"}');
});
