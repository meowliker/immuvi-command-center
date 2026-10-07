import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {createDeleteCreativeHandler} from '../api/delete-creative.js';

for (const file of ['immuvi-command-center.html', 'public/immuvi-command-center.html']) {
  const html = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const code = html.slice(html.indexOf('function _isSupabaseAuthError'), html.indexOf('function openEditCreative('));
  function setup() {
    const calls = {requests: [], clickup: [], broadcasts: [], saves: [], refreshes: 0};
    const state = {status: 200, verified: true};
    const c = vm.createContext({console, Date, Set, AbortSignal,
      activeProductId: 'A', _adsProductId: 'A', _uiProductGeneration: 1,
      _productSwitchPending: false, _cloudLoadFailed: false, AUTH: {}, CFG: {key: 'cu-key'},
      ADS: [{id: 'ad', _clickupId: 'cu', status: 'Testing'}, {id: 'child', parentAdId: 'ad', notes: 'Keep'}],
      MANUAL_ACTIONS: [{id: 'ma', sourceAdId: 'ad', _clickupId: 'cu'}, {id: 'other', sourceAdId: 'child'}],
      PROD: [{adId: 'ad'}, {adId: 'child'}], INSPIRATIONS: [],
      _deletedAdIdsCache: new Set(), _deletedAdClickUpIdsCache: new Set(),
      _myClientId: 'self', _rtChannel: {send: x => calls.broadcasts.push(x)},
      SB: {auth: {
        getSession: async () => ({data: {session: {access_token: 'user-token'}}}),
        refreshSession: async () => {calls.refreshes++; state.status = 200; return {data: {session: {access_token: 'fresh', user: {id: 'user'}}}};}
      }, realtime: {setAuth() {}}, from: () => {throw new Error('Direct Supabase delete must not run');}},
      _withCloudTimeout: async p => p, _saveScheduled: null, _saveQueue: Promise.resolve(),
      _flushStateToSupabase: async id => calls.saves.push(id),
      setTimeout: fn => {fn(); return 1;}, clearTimeout() {},
      localStorage: {getItem: () => null, setItem() {}},
      toast() {}, _rememberAdDeletion() {}, _rememberManualActionDeletion() {},
      purgeOrphanedMatrixKeys() {}, process: () => ({}), deriveWinners() {}, genActions() {},
      buildCreativeUsageIndex() {}, populateFilterOptions() {}, renderAll() {},
      apiDeleteTask: async (...args) => calls.clickup.push(args),
      fetch: async (url, opts) => {
        calls.requests.push({url, opts});
        if (state.reject) throw new TypeError('Failed to fetch');
        if (state.wait) await state.wait;
        if (state.afterSend) state.afterSend();
        const b = JSON.parse(opts.body);
        return {ok: state.status === 200, status: state.status, json: async () => state.status === 200 ? {
          id: b.adId, productId: state.wrongProduct ? 'B' : b.productId,
          clickupTaskIds: b.expectedClickUpId ? [b.expectedClickUpId] : [],
          deletedAt: '2026-10-07T06:00:00Z', verified: state.verified
        } : {error: 'Rejected'}};
      }
    });
    vm.runInContext(code, c);
    return {c, calls, state};
  }
  test(file + ': same-origin delete forwards caller identity and retries authentication once', async () => {
    const {c, calls, state} = setup(); state.status = 401;
    await c._softDeleteAdWithSessionRetry('ad', 'A', 1, 'cu');
    assert.equal(calls.refreshes, 1); assert.equal(calls.requests.length, 2);
    assert.equal(calls.requests[0].url, '/api/delete-creative');
    assert.equal(calls.requests[0].opts.headers.Authorization, 'Bearer user-token');
    assert.equal(calls.requests[0].opts.body, calls.requests[1].opts.body);
    assert.deepEqual(JSON.parse(calls.requests[0].opts.body), {adId: 'ad', productId: 'A', expectedClickUpId: 'cu'});
  });
  test(file + ': failures preserve all local state and never delete in ClickUp', async () => {
    for (const change of [{status: 403}, {status: 409}, {status: 503}, {reject: true}, {verified: false}, {wrongProduct: true}]) {
      const {c, calls, state} = setup(); Object.assign(state, change);
      const before = JSON.stringify([c.ADS, c.MANUAL_ACTIONS, c.PROD]);
      await c.deleteAdEverywhere('ad');
      assert.equal(JSON.stringify([c.ADS, c.MANUAL_ACTIONS, c.PROD]), before);
      assert.equal(calls.clickup.length + calls.broadcasts.length + calls.saves.length, 0);
      assert.equal(calls.requests.length, 1); assert.equal(calls.refreshes, 0);
      assert.equal(c._creativeDeletesInFlight.size, 0);
    }
  });
  test(file + ': confirmed delete only removes the chosen creative and its own actions', async () => {
    const {c, calls} = setup(); await c.deleteAdEverywhere('ad'); await c._saveQueue;
    assert.deepEqual(Array.from(c.ADS, x => x.id), ['child']);
    assert.equal(c.ADS[0].notes, 'Keep');
    assert.deepEqual(Array.from(c.MANUAL_ACTIONS, x => x.id), ['other']);
    assert.deepEqual(Array.from(c.PROD, x => x.adId), ['child']);
    assert.deepEqual(calls.clickup, [['cu', 'cu-key']]);
    assert.deepEqual(calls.saves, ['A']);
    assert.equal(calls.broadcasts[0].payload.productId, 'A');
  });
  test(file + ': double clicks are single-flight; a product switch cannot mutate the new view', async () => {
    const {c, calls, state} = setup(); let resolve;
    state.wait = new Promise(r => {resolve = r;});
    const pending = c.deleteAdEverywhere('ad'); await c.deleteAdEverywhere('ad');
    await Promise.resolve(); assert.equal(calls.requests.length, 1);
    c.activeProductId = c._adsProductId = 'B'; c._uiProductGeneration++;
    c.ADS = [{id: 'ad', notes: 'Other product'}]; resolve(); await pending;
    assert.equal(c.ADS[0].notes, 'Other product');
    assert.deepEqual(calls.clickup, [['cu', 'cu-key']]);
    assert.equal(calls.broadcasts.length + calls.saves.length, 0);
  });
  test(file + ': loading guards and conflicting task identities prevent requests', async () => {
    for (const change of [{_adsProductId: 'B'}, {_productSwitchPending: true}, {_cloudLoadFailed: true}, {SB: null}]) {
      const {c, calls} = setup(); Object.assign(c, change); await c.deleteAdEverywhere('ad'); assert.equal(calls.requests.length, 0);
    }
    const {c, calls} = setup(); c.MANUAL_ACTIONS[0]._clickupId = 'different';
    await c.deleteAdEverywhere('ad'); assert.equal(calls.requests.length, 0);
  });
  test(file + ': queued post-delete save cannot flush a different product', async () => {
    const {c, calls} = setup(); let release;
    c._saveQueue = new Promise(r => {release = r;});
    await c.deleteAdEverywhere('ad');
    c.activeProductId = c._adsProductId = 'B'; c._uiProductGeneration++;
    release(); await c._saveQueue; assert.equal(calls.saves.length, 0);
  });
}

function server() {
  const calls = [], state = {status: 200, code: null, deletedAt: '2026-10-07T06:00:00Z'};
  const handler = createDeleteCreativeHandler({env: {SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-key'},
    fetchImpl: async (url, opts) => {
      calls.push({url, opts});
      if (state.reject) throw new TypeError('Failed to fetch');
      return url.includes('/rpc/') ? {ok: state.status === 200, status: state.status, json: async () => state.code ? {code: state.code} :
        {id: 'ad', productId: 'A', clickupTaskIds: ['cu'], deletedAt: '2026-10-07T06:00:00Z'}} :
        {ok: true, json: async () => [{id: 'ad', deleted_at: state.deletedAt}]};
    }});
  const req = {method: 'POST', headers: {authorization: 'Bearer user-token'}, body: {adId: 'ad', productId: 'A', expectedClickUpId: 'cu'}};
  const res = {setHeader() {}, status(n) {this.statusCode = n; return this;}, json(body) {this.body = body; return this;}};
  return {handler, req, res, calls, state};
}
test('delete API forwards user identity and verifies persisted deletion', async () => {
  const {handler, req, res, calls} = server(); await handler(req, res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.verified, true);
  assert.equal(calls[0].opts.headers.Authorization, 'Bearer user-token');
  assert.deepEqual(JSON.parse(calls[0].opts.body), {p_ad_id: 'ad', p_product_id: 'A', p_expected_clickup_id: 'cu'});
  assert.ok(calls[1].url.includes('product_id=eq.A'));
});
test('delete API rejects invalid or unauthenticated requests without database access', async () => {
  for (const mode of ['token', 'body', 'method', 'identity']) {
    const {handler, req, res, calls} = server();
    if (mode === 'token') req.headers = {};
    if (mode === 'body') req.body = '{';
    if (mode === 'method') req.method = 'GET';
    if (mode === 'identity') req.body.expectedClickUpId = {};
    await handler(req, res); assert.ok(res.statusCode >= 400); assert.equal(calls.length, 0);
  }
});
test('delete API preserves auth/conflict failures and does not claim unverified success', async () => {
  for (const [code, status] of [['42501', 403], ['P0002', 404], ['PT409', 409], ['40001', 409], ['PGRST301', 401]]) {
    const {handler, req, res, state, calls} = server(); state.status = status; state.code = code;
    await handler(req, res); assert.equal(res.statusCode, status); assert.equal(calls.length, 1);
  }
  for (const change of [{deletedAt: null}, {deletedAt: '2026-01-01'}, {reject: true}]) {
    const {handler, req, res, state} = server(); Object.assign(state, change);
    await handler(req, res); assert.ok(res.statusCode >= 500); assert.ok(!res.body.verified);
  }
});
