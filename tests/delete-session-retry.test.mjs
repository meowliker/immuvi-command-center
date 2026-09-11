import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const files = [
  'immuvi-command-center.html',
  'public/immuvi-command-center.html'
];

function helperSource(html) {
  const start = html.indexOf('function _isSupabaseAuthError');
  const end = html.indexOf('async function deleteAdEverywhere', start);
  assert.ok(start >= 0 && end > start, 'delete session helpers must exist');
  return html.slice(start, end);
}

function loadHelpers(source, sb) {
  const context = {
    SB: sb,
    AUTH: {},
    console: { warn() {} },
    Date
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

for (const file of files) {
  test(`${file} refreshes and retries an auth-rejected delete`, async () => {
    const html = await readFile(file, 'utf8');
    assert.doesNotMatch(html, /Delete failed — Supabase unreachable/);

    let refreshes = 0;
    let updates = 0;
    const sb = {
      auth: {
        async getSession() {
          return { data: { session: { expires_at: Math.floor(Date.now() / 1000) + 3600 } } };
        },
        async refreshSession() {
          refreshes += 1;
          return { data: { session: { access_token: 'fresh', user: { id: 'user-1' } } }, error: null };
        }
      },
      realtime: { setAuth() {} },
      from(table) {
        assert.equal(table, 'ads');
        return {
          update() {
            return {
              async eq() {
                updates += 1;
                return updates === 1
                  ? { error: { status: 401, code: 'PGRST301', message: 'JWT expired' } }
                  : { error: null };
              }
            };
          }
        };
      }
    };

    const helpers = loadHelpers(helperSource(html), sb);
    const response = await helpers._softDeleteAdWithSessionRetry('AD-1', new Date().toISOString());
    assert.equal(response.error, null);
    assert.equal(refreshes, 1);
    assert.equal(updates, 2);
    assert.equal(helpers.AUTH.user.id, 'user-1');
  });

  test(`${file} preserves a non-auth database error without retrying`, async () => {
    const html = await readFile(file, 'utf8');
    let refreshes = 0;
    let updates = 0;
    const expected = { code: '23514', message: 'constraint rejected the update' };
    const sb = {
      auth: {
        async getSession() { return { data: { session: null } }; },
        async refreshSession() { refreshes += 1; return { data: { session: null } }; }
      },
      realtime: { setAuth() {} },
      from() {
        return {
          update() {
            return { async eq() { updates += 1; return { error: expected }; } };
          }
        };
      }
    };

    const helpers = loadHelpers(helperSource(html), sb);
    const response = await helpers._softDeleteAdWithSessionRetry('AD-2', new Date().toISOString());
    assert.deepEqual(response.error, expected);
    assert.equal(refreshes, 0);
    assert.equal(updates, 1);
    assert.equal(helpers._supabaseDeleteErrorText(expected), expected.message);
  });
}
