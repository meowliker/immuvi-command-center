const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

function load(file, imports, globals = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  }).outputText;
  runInNewContext(source, { module, exports: module.exports, Error, ...globals, require: imports });
  return module.exports;
}

function hookState() {
  const states = [];
  const setters = [];
  let cursor = 0;
  return {
    reset() { cursor = 0; },
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      setters[index] ||= value => { states[index] = typeof value === 'function' ? value(states[index]) : value; };
      return [states[index], setters[index]];
    },
    useMemo(factory, deps) {
      const index = cursor++;
      if (!states[index] || deps.some((dep, i) => dep !== states[index].deps[i])) states[index] = { deps, value: factory() };
      return states[index].value;
    },
    useEffect() {},
  };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function planFixture(virtual = false) {
  const state = hookState();
  const queueModule = await import('../../lib/services/plan-edit-queue.js');
  const editHook = load('app/command-center/hooks/use-plan-edit-queue.ts', id => id === 'react' ? state : queueModule);
  const save = deferred();
  const promotion = deferred();
  const original = { display: { dbId: 'action', linkedAdId: 'ad', status: 'Untested', lastStatusChangeAt: 1000, isVirtual: virtual }, payload: {}, linkedAdMeta: {}, actionVersion: 'before' };
  let savedSnapshot;
  let reconciledIndex;
  const { useActionPlan } = load('app/command-center/hooks/use-action-plan.ts', id => {
    if (id === 'react') return state;
    if (id === './use-plan-edit-queue') return editHook;
    if (id === '../services/plan-edit-snapshot') return { readPlanEditSnapshot: async (_, __, action) => action };
    if (id === './use-reconciled-state') return { useReconciledState: initial => state.useState(reconciledIndex++ === 0 ? [original] : initial) };
    if (id === './use-live-query') return { useLiveQuery: () => ({ busy: false, error: '', mutate: operation => operation }) };
    if (id === './use-plan-statuses') return { usePlanStatuses: () => ({ statuses: [] }) };
    if (id === './use-plan-field-schema') return { usePlanFieldSchema: () => ({ schema: null }) };
    if (id === './use-plan-bulk') return { usePlanBulk: () => ({ replaceId() {} }) };
    if (id.endsWith('product-config.js')) return { productClickUpListId: () => '' };
    if (id.endsWith('domain/action-plan-adoption.js')) return { planPresentationKeys: () => new Map() };
    if (id.endsWith('services/action-plan-adoption.js')) return { promotePlanAction: () => promotion.promise };
    if (id === '../services/actions') return { persistActionStatus: (_, __, action) => { savedSnapshot = action; return save.promise; } };
    return {};
  });
  return {
    original, save, promotion,
    get savedSnapshot() { return savedSnapshot; },
    render() { state.reset(); reconciledIndex = 0; return useActionPlan({ supabase: {}, activeProductId: 'qa' }); },
  };
}

test('status displays immediately while the persisted snapshot waits for ClickUp confirmation', async () => {
  const f = await planFixture();
  const work = f.render().updateStatus(f.original, 'Testing');
  assert.equal(f.render().actions[0].display.status, 'Testing');
  assert.equal(typeof f.render().actions[0].display.lastStatusChangeAt, 'number');
  assert.equal(f.render().notice, '');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.savedSnapshot.display.status, 'Untested');
  f.save.resolve({ payload: {}, linkedAdMeta: {}, actionVersion: 'after', changedAt: 2000 });
  await work;
  assert.equal(f.render().actions[0].display.status, 'Testing');
  assert.equal(f.render().actions[0].actionVersion, 'after');
  assert.equal(f.render().busyAction, '');
});

test('a failed save restores the previous displayed status and reports the error', async () => {
  const f = await planFixture();
  const work = f.render().updateStatus(f.original, 'Testing');
  f.save.reject(new Error('Save failed'));
  await work;
  assert.equal(f.render().actions[0].display.status, 'Untested');
  assert.equal(f.render().actions[0].display.lastStatusChangeAt, 1000);
  assert.equal(f.render().error, 'Save failed');
});

test('a saved local change stays visible when ClickUp needs a retry', async () => {
  const f = await planFixture();
  const work = f.render().updateStatus(f.original, 'Testing');
  f.save.resolve({ payload: {}, linkedAdMeta: { _trackerPending: { status: true } }, changedAt: 2000, clickUpWarning: 'Saved in QA. ClickUp changes remain pending: timeout' });
  await work;
  assert.equal(f.render().actions[0].display.status, 'Testing');
  assert.equal(f.render().actions[0].linkedAdMeta._trackerPending.status, true);
  assert.match(f.render().error, /remain pending/);
  assert.equal(f.render().notice, '');
});

test('optimistic status survives virtual task promotion and rollback preserves its new identity', async () => {
  const f = await planFixture(true);
  const work = f.render().updateStatus(f.original, 'Testing');
  assert.equal(f.render().actions[0].display.status, 'Testing');
  f.promotion.resolve({ ...f.original, display: { ...f.original.display, dbId: 'promoted', isVirtual: false }, actionVersion: 'promoted-version' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.render().actions[0].display.dbId, 'promoted');
  assert.equal(f.render().actions[0].display.status, 'Testing');
  f.save.reject(new Error('Save failed'));
  await work;
  assert.equal(f.render().actions[0].display.dbId, 'promoted');
  assert.equal(f.render().actions[0].display.status, 'Untested');
  assert.equal(f.render().actions[0].actionVersion, 'promoted-version');
});

test('shared toast countdown uses the same duration as its animation and cleans up timers', () => {
  const state = hookState();
  const timers = new Map();
  let previousDeps, cleanup, nextId = 0;
  const { WorkspaceToast } = load('app/command-center/components/workspace-toasts.tsx', id => {
    if (id === 'react') return { ...require('react'), ...state, useEffect(effect, deps) {
      if (!previousDeps || deps.some((dep, index) => dep !== previousDeps[index])) {
        cleanup?.(); previousDeps = deps; cleanup = effect();
      }
    } };
    if (id.endsWith('.css')) return { default: {} };
    return require(id);
  }, { window: {
    setTimeout(callback, delay) { const id = ++nextId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  } });
  const dismissed = [], dismiss = id => dismissed.push(id);
  const render = toast => { state.reset(); return WorkspaceToast({ toast, dismiss }); };
  const success = { id: 1, message: 'Status changed to Testing.', title: 'Action Plan', kind: 'success', duration: 4000 };
  const element = render(success);
  assert.equal(element.props.children.at(-1).props.style['--toast-duration'], '4000ms');
  assert.equal(timers.get(1).delay, 4000);
  timers.get(1).callback();
  assert.deepEqual(dismissed, [1]);
  const failure = { id: 2, message: 'Save failed', title: 'Action Plan', kind: 'error', duration: 8000 };
  render(failure);
  assert.ok(render(failure));
  assert.equal(timers.size, 1);
  assert.equal(timers.get(2).delay, 8000);
  cleanup();
  assert.equal(timers.size, 0);
});
