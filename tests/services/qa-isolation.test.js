import test from 'node:test';
import assert from 'node:assert/strict';
import { qaPublicSupabaseConfig, QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY } from '../../lib/qa-supabase-env.js';
import * as clickup from '../../app/api/clickup/route.js';
import * as callback from '../../app/api/onescale-launch-callback/route.js';
import * as installer from '../../app/api/install-skill/route.js';
import * as download from '../../app/install-skill.sh/route.js';
import * as skill from '../../app/team-skill/[...path]/route.js';
import { GET as main } from '../../app/immuvi-command-center.html/route.js';
import { GET as actionPlan } from '../../app/action-plan-live.html/route.js';
import { GET as v2 } from '../../app/immuvi-command-center-v2.html/route.js';

const keys = ['QA_SUPABASE_URL', 'NEXT_PUBLIC_QA_SUPABASE_URL', 'QA_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_QA_SUPABASE_ANON_KEY',
  'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY', 'QA_SUPABASE_SERVICE_ROLE_KEY', 'QA_SUPABASE_DB_PASSWORD', 'QA_INSTALL_SKILL_SECRET', 'INSTALL_SKILL_SECRET'];
async function withEnv(values, run) {
  const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, values);
    return await run();
  } finally {
    for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
  }
}
const jwt = (role, ref = 'entgcnlfsnysnwyadzzp') => `fixture.${Buffer.from(JSON.stringify({ role, ref })).toString('base64url')}.signature`;

test('QA public config ignores generic production/arbitrary URLs and credentials', async () => {
  for (const url of ['https://hdniumnkprkadlrrataz.supabase.co', 'https://example.test', QA_SUPABASE_URL]) {
    await withEnv({ SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_ANON_KEY: 'private-generic-value',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'private-public-env-value', SUPABASE_SERVICE_ROLE_KEY: 'private-service-value' }, () => {
      assert.deepEqual(qaPublicSupabaseConfig(), { url: QA_SUPABASE_URL, anonKey: QA_SUPABASE_ANON_KEY });
    });
  }
});
test('every explicit QA host must match the allowlisted project, including lower-priority overrides', async () => {
  for (const key of ['QA_SUPABASE_URL', 'NEXT_PUBLIC_QA_SUPABASE_URL']) {
    for (const url of ['https://hdniumnkprkadlrrataz.supabase.co', 'https://example.test', `${QA_SUPABASE_URL}.example.test`, `${QA_SUPABASE_URL}/path`, ' ']) {
      await withEnv({ QA_SUPABASE_URL, NEXT_PUBLIC_QA_SUPABASE_URL: QA_SUPABASE_URL, [key]: url }, () => assert.throws(qaPublicSupabaseConfig, /restricted/));
    }
  }
  await withEnv({ QA_SUPABASE_URL: ` ${QA_SUPABASE_URL}/ ` }, () => assert.equal(qaPublicSupabaseConfig().url, QA_SUPABASE_URL));
});
test('QA public config rejects service, foreign, malformed and conflicting keys without exposing their value', async () => {
  for (const name of ['QA_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_QA_SUPABASE_ANON_KEY']) {
    for (const key of [jwt('service_role'), jwt('anon', 'foreign'), 'sb_secret_do_not_serialize', 'malformed-private-value', ' ']) {
      await withEnv({ QA_SUPABASE_ANON_KEY, NEXT_PUBLIC_QA_SUPABASE_ANON_KEY: QA_SUPABASE_ANON_KEY, [name]: key }, () => {
        assert.throws(qaPublicSupabaseConfig, (error) => /public anonymous/.test(error.message) && !error.message.includes(key.trim() || 'malformed-private-value'));
      });
    }
  }
});
test('QA public config accepts approved anonymous JWTs and public publishable keys only', async () => {
  for (const key of [QA_SUPABASE_ANON_KEY, jwt('anon'), 'sb_publishable_fixture_public_key']) {
    await withEnv({ QA_SUPABASE_ANON_KEY: key }, () => assert.deepEqual(qaPublicSupabaseConfig(), { url: QA_SUPABASE_URL, anonKey: key }));
  }
});
test('legacy QA integrations stay disabled with credentials supplied: no network calls, environment mutation or secret response', async () => {
  const env = { QA_SUPABASE_URL, QA_SUPABASE_SERVICE_ROLE_KEY: 'private-qa-service', QA_SUPABASE_DB_PASSWORD: 'private-db-password',
    QA_INSTALL_SKILL_SECRET: 'private-installer-secret', SUPABASE_URL: 'https://production.example.test', SUPABASE_SERVICE_ROLE_KEY: 'private-production-key' };
  await withEnv(env, async () => {
    const before = { ...process.env }, original = globalThis.fetch;
    globalThis.fetch = async () => assert.fail('A disabled integration attempted a network request');
    try {
      for (const [route, handlers] of [['/api/clickup?path=/task/production-task', clickup], ['/api/onescale-launch-callback', callback],
        ['/api/install-skill', installer], ['/install-skill.sh', download], ['/team-skill/classify_inspiration.py', skill]]) {
        for (const [method, handler] of Object.entries(handlers)) {
          const request = new Request(`http://localhost${route}`, { method, headers: { Authorization: 'Bearer private-token', 'x-clickup-token': 'private-clickup-key' } });
          const response = await handler(request, { params: Promise.resolve({ path: ['classify_inspiration.py'] }) });
          assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'no-store');
          const body = await response.json(); assert.equal(body.code, 'QA_INTEGRATION_DISABLED'); assert.equal(body.dispatchEnabled, false);
          assert.doesNotMatch(JSON.stringify(body), /private-/);
        }
      }
      assert.deepEqual({ ...process.env }, before);
    } finally { globalThis.fetch = original; }
  });
});
test('all legacy HTML bookmarks redirect to the same root without returning executable HTML', async () => {
  for (const handler of [main, actionPlan, v2]) {
    const response = await handler();
    assert.equal(response.status, 307); assert.equal(response.headers.get('location'), '/');
    assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(await response.text(), '');
  }
});
