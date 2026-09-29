const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function fixture() {
  let cursor = 0, reloads = 0;
  const slots = [];
  const state = {
    profile: { id: 'qa-user', username: 'App Login', role: 'admin' },
    members: [{ id: 'qa-user', name: 'ClickUp Name' }], presenceStatus: 'online',
    reloadAvailable: true, busy: false, reloadError: '', requestReload: async () => { reloads++; },
  };
  const module = { exports: {} };
  const source = ts.transpileModule(readFileSync('app/command-center/components/workspace-session.tsx', 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  }).outputText;
  runInNewContext(source, { module, exports: module.exports, require: id => {
    if (id === 'react') return { ...React, useContext: () => state, useId: () => 'online-popover', useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = value; }];
    } };
    if (id.endsWith('.css')) return { default: new Proxy({}, { get: (_, key) => key }) };
    if (id === './tracker-dialog') return { TrackerDialog: ({ children, title, className }) => React.createElement('section', { role: 'dialog', 'aria-label': title, className }, children) };
    if (id === '../hooks/use-anchored-popover') return { useAnchoredPopover: () => ({ trigger: { current: null }, panel: { current: null } }) };
    if (id.startsWith('.')) return {};
    return require(id);
  } });
  return { get reloads() { return reloads; }, render(name) { cursor = 0; return module.exports[name]({ signOut() {} }); } };
}

test('force reload uses the device icon and sends nothing until Yes is confirmed', async () => {
  const f = fixture();
  let tree = f.render('ForceReloadControl');
  const open = tree.props.children[0];
  assert.match(renderToStaticMarkup(open), /lucide-monitor-up/);
  open.props.onClick();
  tree = f.render('ForceReloadControl');
  const dialog = tree.props.children[1];
  assert.equal(dialog.props.className, 'reloadConfirm');
  const footer = dialog.props.children.at(-1);
  assert.deepEqual(Array.from(footer.props.children, button => button.props.children), ['Cancel', 'Yes']);
  footer.props.children[0].props.onClick();
  assert.equal(f.reloads, 0);
  assert.equal(f.render('ForceReloadControl').props.children[1], null);
  f.render('ForceReloadControl').props.children[0].props.onClick();
  await f.render('ForceReloadControl').props.children[1].props.children.at(-1).props.children[1].props.onClick();
  assert.equal(f.reloads, 1);
});

test('online users are an anchored auto-dismiss popover, not a modal dialog', () => {
  const f = fixture();
  const html = renderToStaticMarkup(f.render('SessionHeaderControls'));
  assert.match(html, /popoverTarget="online-popover"/i);
  assert.match(html, /id="online-popover" popover="auto" role="dialog"/);
  assert.match(html, /peoplePopover/);
  assert.match(html, /ClickUp Name/);
  assert.ok(!html.includes('<dialog'));
  assert.ok(!html.includes('trackerDialog'));
});
