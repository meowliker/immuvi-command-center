import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../../app/api/clickup/qa-cleanup/route.js';

test('cleanup API denies unconfigured, foreign, anonymous, member and password-pending callers before remote access', async () => {
  const before = { url: process.env.QA_SUPABASE_URL, key: process.env.QA_SUPABASE_SERVICE_ROLE_KEY }, originalFetch = globalThis.fetch;
  const input = { operation: 'preview', productId: 'qa' }; let profile = { role: 'member', is_active: true, must_change_password: false };
  const req = (auth = true) => new Request('http://localhost/api/clickup/qa-cleanup', { method: 'POST', headers: auth ? { Authorization: 'Bearer fixture' } : {}, body: JSON.stringify(input) });
  try {
    delete process.env.QA_SUPABASE_SERVICE_ROLE_KEY; assert.equal((await POST(req())).status, 503);
    process.env.QA_SUPABASE_SERVICE_ROLE_KEY = 'qa-fixture'; process.env.QA_SUPABASE_URL = 'https://hdniumnkprkadlrrataz.supabase.co'; assert.equal((await POST(req())).status, 503);
    delete process.env.QA_SUPABASE_URL; assert.equal((await POST(req(false))).status, 401);
    globalThis.fetch = async (url) => {
      const parsed = new URL(url); assert.equal(parsed.origin, 'https://entgcnlfsnysnwyadzzp.supabase.co');
      if (parsed.pathname === '/auth/v1/user') return Response.json({ id: '11111111-1111-4111-8111-111111111111' });
      assert.equal(parsed.pathname, '/rest/v1/profiles'); return Response.json(profile);
    };
    for (const value of [{ role: 'member', is_active: true, must_change_password: false }, { role: 'admin', is_active: false, must_change_password: false }, { role: 'admin', is_active: true, must_change_password: true }]) {
      profile = value; const response = await POST(req()); assert.equal(response.status, 403); assert.equal(response.headers.get('cache-control'), 'no-store');
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (before.url === undefined) delete process.env.QA_SUPABASE_URL; else process.env.QA_SUPABASE_URL = before.url;
    if (before.key === undefined) delete process.env.QA_SUPABASE_SERVICE_ROLE_KEY; else process.env.QA_SUPABASE_SERVICE_ROLE_KEY = before.key;
  }
});
