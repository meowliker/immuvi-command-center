import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../../app/api/admin/[op]/route.js';

test('QA admin route rejects legacy unversioned access writes without contacting a backend', async () => {
  for (const op of ['set-role', 'update-products', 'assign-product', 'unassign-product']) {
    const response = await POST(new Request(`http://localhost/api/admin/${op}`, { method: 'POST' }), { params: Promise.resolve({ op }) });
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /versioned QA/);
  }
});
test('QA admin route refuses a production or arbitrary QA URL before importing the legacy handler', async () => {
  const before = process.env.QA_SUPABASE_URL;
  try {
    for (const url of ['https://hdniumnkprkadlrrataz.supabase.co', 'https://example.test']) {
      process.env.QA_SUPABASE_URL = url;
      const response = await POST(new Request('http://localhost/api/admin/health', { method: 'POST' }), { params: Promise.resolve({ op: 'health' }) });
      assert.equal(response.status, 503);
    }
  } finally { if (before === undefined) delete process.env.QA_SUPABASE_URL; else process.env.QA_SUPABASE_URL = before; }
});

test('native QA account route verifies caller, fixes the destination, avoids global env mutation and returns no-store results', async () => {
  const actor = '11111111-1111-4111-8111-111111111111', target = '22222222-2222-4222-8222-222222222222';
  const input = { requestId: '33333333-3333-4333-8333-333333333333', userId: target, operation: 'deactivate', revision: 'a'.repeat(32), confirmEmail: '' };
  const keys = ['QA_SUPABASE_URL','QA_SUPABASE_SERVICE_ROLE_KEY','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
  const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch, calls = []; let allow = true, applied = false;
  try {
    delete process.env.QA_SUPABASE_URL;
    process.env.QA_SUPABASE_SERVICE_ROLE_KEY = 'fixture-qa-service-key';
    process.env.SUPABASE_URL = 'https://hdniumnkprkadlrrataz.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'must-not-use';
    globalThis.fetch = async (url, options = {}) => {
      const parsed = new URL(url); assert.equal(parsed.origin, 'https://entgcnlfsnysnwyadzzp.supabase.co');
      calls.push(parsed.pathname);
      const json = (value) => Response.json(value);
      if (parsed.pathname === '/auth/v1/user') return json({ id: actor, email: 'actor@example.test' });
      if (parsed.pathname === '/rest/v1/profiles') return json({ role: allow ? 'admin' : 'member', is_active: true, must_change_password: false });
      if (parsed.pathname === '/rest/v1/rpc/qa_account_prepare') {
        const body = JSON.parse(options.body); assert.equal(body.p_actor, actor);
        return json({ request_id: input.requestId, target_id: target, actor_id: actor, operation: 'deactivate', state: 'sending', canSend: true });
      }
      if (parsed.pathname === `/auth/v1/admin/users/${target}`) {
        if (options.method === 'PUT') {
          const body = JSON.parse(options.body); assert.equal(body.ban_duration, '876600h'); assert.equal(body.app_metadata.qa_account_request, input.requestId); applied = true;
        }
        return json({ id: target, app_metadata: { existing: 'keep' } });
      }
      if (parsed.pathname === '/rest/v1/rpc/qa_account_finish') {
        assert.ok(applied); return json({ state: 'completed', requestId: input.requestId, userId: target, operation: 'deactivate', credentialsAvailable: false, dispatchEnabled: false,
          user: { id: target, access_revision: 'b'.repeat(32), is_active: false } });
      }
      assert.fail(`Unexpected request ${parsed.pathname}`);
    };
    const req = () => new Request('http://localhost/api/admin/deactivate', { method: 'POST', headers: { Authorization: 'Bearer fixture-token', 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const response = await POST(req(), { params: Promise.resolve({ op: 'deactivate' }) });
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal((await response.json()).operation, 'deactivate');
    assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY, 'must-not-use'); assert.ok(process.env.SUPABASE_URL.includes('hdniumnkprkadlrrataz'));
    allow = false; const denied = await POST(req(), { params: Promise.resolve({ op: 'deactivate' }) }); assert.equal(denied.status, 403);
    assert.equal(calls.filter((path) => path === '/rest/v1/rpc/qa_account_prepare').length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
  }
});
