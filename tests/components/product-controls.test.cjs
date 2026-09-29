const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function loadComponent(file, connection) {
  const filename = resolve(file);
  const localRequire = createRequire(filename);
  const module = { exports: {} };
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  runInNewContext(source, { module, exports: module.exports, require: (id) => {
    if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
    if (id === './clickup-provider') return { useClickUpControls: () => connection };
    if (id === './clickup-error-notice') return loadComponent('app/command-center/components/clickup-error-notice.tsx', connection);
    if (id === './workspace-session') return { ForceReloadControl: () => null };
    if (id === './workspace-toasts') return { useWorkspaceNotice: value => { if (value.message) (connection.toastCalls ||= []).push(value); } };
    if (id === './tracker-dialog') return { TrackerDialog: ({ children, title, className }) => React.createElement('section', { 'aria-label': title, className }, children) };
    if (id === '../helpers/format') return localRequire(`${id}.ts`);
    if (id === './command-hq-operations') return loadComponent('app/command-center/components/command-hq-operations.tsx', connection);
    if (id === '../hooks/use-product-administration') return { useProductAdministration: () => ({ ready: true, busy: false, pending: null }) };
    if (id === './stale-ad-cleanup') return { StaleAdCleanup: () => React.createElement('button', null, 'Clean stale') };
    return localRequire(id);
  } });
  return module.exports;
}
const product = { id: 'qa-fixture', name: 'QA Fixture', config: { clickup_list_id: '1301130000002447', clickup_list_name: 'Test List', last_synced_at_ms: Date.now() - 120000, last_synced_count: 0 } };
const baseConnection = { busy: '', token: 'synthetic-test-token', error: '', notice: '', run() {}, openSettings() {} };
function row(profile = { role: 'admin' }, connection = baseConnection, selectedProduct = product) {
  const { CommandHqOperations } = loadComponent('app/command-center/components/command-hq-operations.tsx', connection);
  return renderToStaticMarkup(React.createElement(CommandHqOperations, { product: selectedProduct, profile }));
}
test('linked product shows the compact legacy actions and sync metadata, including zero tasks', () => {
  const html = row();
  assert.match(html, /Test List/);
  assert.match(html, />Change<\/button>/);
  assert.match(html, /Sync Now/);
  assert.match(html, /Last synced/);
  assert.match(html, /0 tasks/);
  for (const extra of ['Tasks checked', 'Detected fields', 'Auto-sync', 'Last saved sync', 'Configure fields']) assert.ok(!html.includes(extra));
  assert.ok(!html.includes('<dl'));
});
test('unlinked product offers linking without unusable sync controls', () => {
  const html = row({ role: 'admin' }, baseConnection, { ...product, config: {} });
  assert.match(html, /Link ClickUp List/);
  assert.match(html, /Link a list to enable sync/);
  assert.ok(!html.includes('Sync Now'));
});
test('members cannot change links and sync stays disabled without a key or for blocked lists', () => {
  assert.ok(!row({ role: 'member' }).includes('>Change<'));
  assert.match(row({ role: 'member' }, { ...baseConnection, token: '' }), /class="productSyncButton"[^>]*disabled/);
  assert.match(row({ role: 'admin' }, baseConnection, { ...product, config: { clickup_list_id: 'production-list' } }), /class="productSyncButton"[^>]*disabled/);
  assert.match(row({ role: 'admin' }, { ...baseConnection, busy: 'sync' }), /Syncing/);
});
test('list dialog uses legacy hierarchy, Select, manual fallback and Save without mapping controls', () => {
  const connection = { ...baseConnection, settingsOpen: true, listInput: '1301130000002447', schema: {
    list: { id: '1301130000002447', name: 'Test List', spaceName: 'Test Space', folderName: 'Test Folder' }, fields: [], mappings: {},
  } };
  const { ClickUpConnection } = loadComponent('app/command-center/components/clickup-connection.tsx', connection);
  const html = renderToStaticMarkup(React.createElement(ClickUpConnection, { product, profile: { role: 'admin' } }));
  for (const label of ['Test Space', 'Test Folder', 'Test List', '>Select<', 'Manual entry (fallback)', '>Save<', '>Cancel<']) assert.ok(html.includes(label), label);
  for (const label of ['Detected fields', 'custom fields detected', 'Refresh available lists', 'Link and sync', 'Not mapped']) assert.ok(!html.includes(label), label);
  assert.match(html, /legacyProductDialog/);
});

test('admin product controls match the legacy row order, with Add Product in the header', () => {
  const { ProductAdministration } = loadComponent('app/command-center/components/product-administration.tsx', baseConnection);
  const html = renderToStaticMarkup(React.createElement(ProductAdministration, { db: {}, userId: 'qa-admin', product, profile: { role: 'admin' }, children: null }));
  const labels = ['Add Product', '>Change<', 'Unlink', 'Sync Now', 'Setup Fields', 'Clean stale', 'Last synced', 'Manage Fields', '>Delete<'];
  let position = -1;
  for (const label of labels) { const next = html.indexOf(label); assert.ok(next > position, label); position = next; }
  for (const label of ['Configure fields', 'ClickUp settings', 'Refresh Command HQ', 'Manage field options']) assert.ok(!html.includes(label));
  const member = renderToStaticMarkup(React.createElement(ProductAdministration, { db: {}, userId: 'qa-member', product, profile: { role: 'member' }, children: null }));
  for (const label of ['Add Product', '>Change<', 'Unlink', 'Setup Fields', 'Clean stale', 'Manage Fields', '>Delete<']) assert.ok(!member.includes(label), label);
});

test('ClickUp errors reach the shared notification stack exactly once, in or outside the list popup', () => {
  for (const settingsOpen of [false, true]) {
    for (const failure of [{ error: 'List already linked', identityError: '' }, { error: '', identityError: 'Key verification failed' }]) {
      const connection = { ...baseConnection, ...failure, settingsOpen, listInput: '', dismissError() {} };
      const { HeaderClickUpControls } = loadComponent('app/command-center/components/header-clickup-controls.tsx', connection);
      const { ClickUpConnection } = loadComponent('app/command-center/components/clickup-connection.tsx', connection);
      const { CommandHqOperations } = loadComponent('app/command-center/components/command-hq-operations.tsx', connection);
      const props = { product, profile: { role: 'admin' } };
      const html = renderToStaticMarkup(React.createElement(React.Fragment, null,
        React.createElement(HeaderClickUpControls, props), React.createElement(ClickUpConnection, props), React.createElement(CommandHqOperations, props)));
      assert.equal((html.match(/role="alert"/g) || []).length, 0);
      assert.equal(connection.toastCalls.length, 1);
      assert.equal(connection.toastCalls[0].kind, 'error');
      assert.equal(connection.toastCalls[0].message, failure.error || failure.identityError);
      assert.ok(!html.includes('Latest operation:'));
    }
  }
});

test('ClickUp forwards dismissal to the shared stack and never creates a second overlay', () => {
  const connection = {};
  const { ClickUpErrorNotice } = loadComponent('app/command-center/components/clickup-error-notice.tsx', connection);
  let message = 'List already linked';
  const element = ClickUpErrorNotice({ message, onDismiss: () => { message = ''; } });
  assert.equal(element, null);
  connection.toastCalls[0].onDismiss();
  assert.equal(ClickUpErrorNotice({ message, onDismiss() {} }), null);
});

test('API key input stays visible without triggering login-password managers', () => {
  const connection = { ...baseConnection, identity: { name: 'ClickUp User' }, autoSync: true };
  const { HeaderClickUpControls } = loadComponent('app/command-center/components/header-clickup-controls.tsx', connection);
  const html = renderToStaticMarkup(React.createElement(HeaderClickUpControls, { product }));
  assert.match(html, /type="text" class="apiTokenInput"/);
  assert.match(html, /name="clickup-api-token"/);
  assert.match(html, /autoComplete="off"/);
  assert.match(html, /data-lpignore="true"/);
  assert.ok(!html.includes('type="password"'));
  assert.match(readFileSync('app/command-center/workspace-header.module.css','utf8'), /apiTokenInput\s*\{\s*-webkit-text-security:none/);
});

test('Action Plan pending writes use error severity in the shared notification stack', () => {
  const connection = {};
  const { PlanSyncNotice } = loadComponent('app/command-center/components/plan-sync-notice.tsx', connection);
  for (const props of [{ message: 'Saved in QA. ClickUp changes remain pending: Request failed.' }, { message: 'Save could not be verified.', error: true }]) {
    const html = renderToStaticMarkup(React.createElement(PlanSyncNotice, props));
    assert.equal(html, '');
    assert.equal(connection.toastCalls.at(-1).kind, 'error');
  }
  const html = renderToStaticMarkup(React.createElement(PlanSyncNotice, { message: 'Pending changes sent to ClickUp.' }));
  assert.equal(html, '');
  assert.equal(connection.toastCalls.at(-1).kind, 'success');
});
