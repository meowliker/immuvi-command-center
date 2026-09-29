const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

function load(file, require, globals = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  runInNewContext(source, { module, exports: module.exports, require, Error, AbortController, ...globals });
  return module.exports;
}
const preferenceKey = user => `immuvi:qa:entgcnlfsnysnwyadzzp:clickup:${user}:live-sync`;
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture({ off = false, key = 'test-key', linked = true } = {}) {
  const storage = new Map(off ? [[preferenceKey('user'), 'false']] : []);
  const timeouts = new Map(), intervals = new Map(), calls = [], commits = [], slots = [];
  let cursor = 0, dirty = false, effects = [], nextTimer = 0, failSync = false, pendingSync, writeHeld = false, commitError = null;
  const sync = { beginWrite() { if (writeHeld) return null; writeHeld = true; return () => { writeHeld = false; }; } };
  const window = {
    localStorage: { getItem: name => storage.get(name) ?? null, setItem: (name, value) => storage.set(name, value) },
    setTimeout(callback) { const id = ++nextTimer; timeouts.set(id, callback); return id; }, clearTimeout: id => timeouts.delete(id),
    setInterval(callback) { const id = ++nextTimer; intervals.set(id, callback); return id; }, clearInterval: id => intervals.delete(id),
    addEventListener() {}, removeEventListener() {},
  };
  const preferences = load('app/command-center/services/qa-clickup.ts', () => ({}), { window });
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { const next = typeof value === 'function' ? value(slots[index]) : value; if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true; } }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial }; },
    useEffect(callback, deps) {
      const index = cursor++, old = slots[index];
      if (!old || !deps || deps.some((dep, i) => !Object.is(dep, old.deps[i]))) {
        effects.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: callback() }; });
      }
    },
  };
  react.useLayoutEffect = react.useEffect;
  const product = { id: 'qa', config: { clickup_list_id: linked ? 'approved' : '' } };
  const { useClickUpConnection } = load('app/command-center/hooks/use-clickup-connection.ts', id => {
    if (id === 'react') return react;
    if (id.endsWith('product-config.js')) return { productClickUpListId: product => product.config.clickup_list_id };
    if (id.endsWith('clickup-sync.js')) return { QA_CLICKUP_LIST_ID: 'approved', assertQaClickUpList: id => assert.equal(id, 'approved') };
    if (id.endsWith('command-hq-health.js')) return { verifyClickUpSyncSummary: () => '1 tasks checked: 0 imported, 0 updated, 0 skipped.' };
    if (id.endsWith('live-sync.js')) return { getLiveSync: () => sync };
    if (id === '../services/qa-clickup') return {
      ...preferences, qaClickUpToken: () => key, storeQaClickUpToken() {},
      async requestQaClickUp(_, __, input) {
        calls.push(input.operation);
        if (input.operation === 'identity') return { user: { id: '42', name: 'ClickUp User' } };
        if (failSync) throw new Error('Temporary ClickUp failure');
        if (pendingSync) await pendingSync;
        return { productId: 'qa', listId: 'approved', productUpdatedAt: 'version', plan: { ads: [], actions: [] } };
      },
    };
    return {};
  }, { window, navigator: { onLine: true }, document: { hidden: false, addEventListener() {}, removeEventListener() {} } });
  const db = { rpc(name, args) { assert.equal(writeHeld, true); commits.push({ name, args }); return { abortSignal: async () => ({ data: {}, error: commitError }) }; } };
  const render = () => {
    let result, count = 0;
    do {
      dirty = false; cursor = 0; effects = [];
      result = useClickUpConnection(db, product, 'user', true);
      for (const effect of effects) effect();
      if (++count > 20) throw new Error('Render loop');
    } while (dirty);
    return result;
  };
  return {
    render, calls, commits, storage, intervals, product, startEdit: () => sync.beginWrite(),
    set commitError(value) { commitError = value; },
    set fail(value) { failSync = value; },
    set pending(value) { pendingSync = value; },
    async verify() { for (const [id, callback] of timeouts) { timeouts.delete(id); callback(); } await tick(); render(); await tick(); return render(); },
    dispose() { for (const slot of slots) slot?.cleanup?.(); },
  };
}

test('live sync defaults on and starts automatically only after key verification', async () => {
  const f = fixture();
  assert.equal(f.render().autoSync, true);
  assert.deepEqual(f.calls, []);
  await f.verify();
  assert.deepEqual(f.calls, ['identity', 'sync']);
  assert.equal(f.commits.length, 1);
  assert.equal(f.render().error, '');
  assert.equal(f.intervals.size, 1);
  f.dispose();
  assert.equal(f.intervals.size, 0);
});

test('ClickUp network reads leave edits unlocked and imports yield to a user edit', async () => {
  const f = fixture(); let finishRead;
  f.pending = new Promise(resolve => { finishRead = resolve; });
  f.render(); await f.verify();
  const finishEdit = f.startEdit();
  assert.equal(typeof finishEdit, 'function');
  finishRead(); await tick();
  assert.equal(f.commits.length, 0);
  assert.equal(f.render().error, '');
  finishEdit();
  await f.render().run('sync', undefined, true);
  assert.equal(f.commits.length, 1);
  f.dispose();
});

test('background imports discard stale snapshots instead of overwriting edits or showing false save errors', async () => {
  const f = fixture();
  f.commitError = { message: 'Creative changed during sync. Nothing was imported; retry.' };
  f.render(); await f.verify();
  assert.equal(f.render().error, '');
  assert.equal(f.render().lastSyncedAt, 0);
  assert.equal(f.render().autoSync, true);
  f.dispose();
});

test('saved opt-out survives refresh and manual sync does not turn it back on', async () => {
  const f = fixture({ off: true });
  assert.equal(f.render().autoSync, false);
  await f.verify();
  assert.deepEqual(f.calls, ['identity']);
  await f.render().run('sync');
  assert.equal(f.render().autoSync, false);
  assert.equal(f.intervals.size, 0);
  f.dispose();
});

test('switching off during an active sync stays off when that request completes', async () => {
  const f = fixture(); let finish;
  f.pending = new Promise(resolve => { finish = resolve; });
  f.render(); await f.verify();
  f.render().setAutoSync(false);
  assert.equal(f.render().autoSync, false);
  assert.equal(f.storage.get(preferenceKey('user')), 'false');
  assert.equal(f.intervals.size, 0);
  finish(); await tick();
  assert.equal(f.render().autoSync, false);
  f.dispose();
});

test('transient failures and connection changes do not erase the live-sync preference', async () => {
  const f = fixture(); f.fail = true;
  f.render(); await f.verify();
  assert.match(f.render().error, /Temporary/);
  assert.equal(f.render().autoSync, true);
  f.product.config.clickup_list_id = '';
  assert.equal(f.render().autoSync, true);
  assert.equal(f.intervals.size, 0);
  f.render().setToken('replacement-key');
  assert.equal(f.render().autoSync, true);
  assert.equal(f.render().identity, null);
  f.dispose();
});

test('missing credentials or an unapproved list never start automatic sync', async () => {
  for (const options of [{ key: '' }, { linked: false }]) {
    const f = fixture(options);
    f.render(); await f.verify();
    assert.equal(f.calls.includes('sync'), false);
    assert.equal(f.intervals.size, 0);
    f.dispose();
  }
});
