const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function fixture() {
  let cursor = 0;
  const slots = [], history = [];
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial }; },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((dep, i) => dep !== slots[index].deps[i])) slots[index] = { callback, deps };
      return slots[index].callback;
    },
    useEffect() {},
  };
  const module = { exports: {} };
  const source = ts.transpileModule(readFileSync('app/command-center/components/workspace-toasts.tsx', 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  }).outputText;
  runInNewContext(source, { module, exports: module.exports, require: id => {
    if (id === 'react') return hooks;
    if (id.endsWith('.css')) return { default: new Proxy({}, { get: (_, key) => key }) };
    return require(id);
  } });
  const record = (message, kind) => history.push({ message, kind });
  function render() { cursor = 0; return module.exports.WorkspaceToasts({ children: null, onRecord: record }); }
  return { ...module.exports, history, emit: render().props.value, items: () => render().props.children[1].props.children };
}

test('three messages share one newest-first stack, and expiring any message preserves history', () => {
  const f = fixture();
  const emit = (source, message) => f.emit(source, { message, title: source, kind: 'error' });
  emit('ClickUp', 'First'); emit('Columns', 'Second'); emit('Action Plan', 'Third');
  assert.deepEqual(Array.from(f.items(), item => item.props.toast.message), ['Third', 'Second', 'First']);
  const oldest = f.items()[2];
  oldest.props.dismiss(oldest.props.toast.id);
  assert.deepEqual(Array.from(f.items(), item => item.props.toast.message), ['Third', 'Second']);
  assert.equal(f.history.length, 3);
  for (const item of f.items()) item.props.dismiss(item.props.toast.id);
  assert.equal(f.items().length, 0);
  assert.equal(f.history.length, 3);
});

test('new messages preserve existing toast identity, duration and expiry callback', () => {
  const f = fixture();
  f.emit('a', { title: 'Action Plan', message: 'Saved', kind: 'success' });
  const old = f.items()[0];
  f.emit('b', { title: 'ClickUp', message: 'Failed', kind: 'error' });
  const retained = f.items()[1];
  assert.equal(retained.key, old.key);
  assert.equal(retained.props.toast, old.props.toast);
  assert.equal(retained.props.dismiss, old.props.dismiss);
  assert.equal(retained.props.toast.duration, 2500);
  assert.equal(f.items()[0].props.toast.duration, 4000);
});

test('rerenders and repeated effects do not duplicate history or restart dismissed notices', () => {
  const f = fixture();
  const message = { title: 'ClickUp', message: 'Failed', kind: 'error' };
  f.emit('source', message); f.emit('source', message);
  assert.equal(f.items().length, 1);
  const item = f.items()[0]; item.props.dismiss(item.props.toast.id);
  f.emit('source', message);
  assert.equal(f.items().length, 0);
  assert.equal(f.history.length, 1);
  f.emit('source', { ...message, message: '' });
  f.emit('source', message);
  assert.equal(f.items().length, 1);
  assert.equal(f.history.length, 2);
});

test('shared cards have severity, progress duration, wrapping text, and dismiss controls', () => {
  const f = fixture();
  for (const kind of ['error', 'success']) {
    f.emit(kind, { title: 'ClickUp', message: 'A long message', kind });
    const item = f.items()[0];
    const html = renderToStaticMarkup(React.createElement(f.WorkspaceToast, item.props));
    assert.match(html, new RegExp(`role="${kind === 'error' ? 'alert' : 'status'}"`));
    assert.match(html, /Dismiss ClickUp notification/);
    assert.match(html, new RegExp(`--toast-duration:${kind === 'error' ? 4000 : 2500}ms`));
    assert.match(html, /aria-hidden="true" class="toastProgress"/);
  }
});
