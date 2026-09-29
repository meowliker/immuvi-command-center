const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

async function fixture(name, options = {}) {
  const modules = {};
  for (const file of ['plan-field-controls', 'action-plan-fields', 'action-plan-editing']) modules[file] = await import(`../../lib/domain/${file}.js`);
  let cursor = 0, hidden = 0, release;
  const slots = [], calls = [];
  const waiting = new Promise(resolve => { release = resolve; });
  const state = {
    useId: () => 'field-picker',
    useRef(initial) { const index = cursor++; slots[index] ??= { current: initial }; return slots[index]; },
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
  };
  const action = { display: { dbId: 'action', linkedAdId: 'ad', title: 'Test', angle: 'Old' }, payload: { sourceAdId: 'ad' },
    linkedAdMeta: { _customFieldsRaw: { reviewer: [7] }, _customFields: { reviewer: 'Original' } } };
  const plan = { fieldSchema: { schema: { fields: [
    { id: 'angle', name: 'Angle Tag', type: 'short_text' },
    { id: 'persona', name: 'Persona Tag', type: 'short_text' },
    { id: 'reviewer', name: 'Reviewer', type: 'users' },
    { id: 'notes', name: 'Notes', type: 'text' },
  ], mappings: { angle: 'angle', persona: 'persona' }, members: [{ id: 7, username: 'Original' }, { id: 8, username: 'New' }] }, taxonomy: { angles: ['Old', 'New'], personas: [] } },
    async saveCreative(...args) { calls.push({ kind: 'creative', args }); return waiting; },
    async saveFields(...args) { calls.push({ kind: 'custom', args }); return waiting; },
  };
  const module = { exports: {} };
  const source = ts.transpileModule(readFileSync('app/command-center/components/plan-field-control.tsx', 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  runInNewContext(source, { module, exports: module.exports, require: id => {
    if (id === 'react') return { ...React, ...state };
    if (id.endsWith('.css')) return { default: new Proxy({}, { get: (_, key) => key }) };
    if (id.endsWith('use-anchored-popover')) return { useAnchoredPopover: () => ({ trigger: { current: null }, panel: { current: { hidePopover() { hidden++; } } } }) };
    for (const [file, exports] of Object.entries(modules)) if (id.endsWith(`/${file}.js`)) return exports;
    if (id.startsWith('.')) return {};
    return require(id);
  } });
  return { calls, action, plan, release, get hidden() { return hidden; }, render() { cursor = 0; return module.exports.PlanFieldControl({ name, action, plan, disabled: false, ...options }); } };
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)];
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('closed field popovers stay hidden inside drawer definition lists', () => {
  const css = readFileSync('app/command-center.module.css', 'utf8');
  assert.match(css, /\.planFieldPopover:not\(:popover-open\)\s*\{\s*display:\s*none;/);
  assert.doesNotMatch(css, /\.actionInspectorBody dl div\s*\{/);
  assert.match(css, /\.actionInspectorBody dl > div\s*\{/);
});

test('inline taxonomy changes display immediately, write canonical fields, and roll back on failure', async () => {
  const f = await fixture('Angle Tag');
  nodes(f.render()).find(node => node.type === 'select').props.onChange({ target: { value: 'New' } });
  assert.equal(nodes(f.render()).find(node => node.type === 'select').props.value, 'New');
  assert.equal(f.calls[0].kind, 'creative'); assert.deepEqual(f.calls[0].args[1], { angle: 'New' });
  assert.equal(f.calls[0].args[2], true);
  f.release(false); await tick();
  assert.equal(nodes(f.render()).find(node => node.type === 'select').props.value, 'Old');
  assert.match(renderToStaticMarkup(f.render()), /Could not save/);
});
test('a dropdown accepts another edit during sync and an older completion cannot reset its latest selection', async () => {
  const f = await fixture('Angle'), releases = [];
  f.plan.saveCreative = () => new Promise(resolve => releases.push(resolve));
  const select = () => nodes(f.render()).find(node => node.type === 'select');
  select().props.onChange({ target: { value: 'New' } });
  assert.equal(select().props.disabled, false);
  select().props.onChange({ target: { value: 'Old' } });
  assert.equal(releases.length, 2); assert.equal(select().props.value, 'Old');
  releases[0](true); await tick();
  assert.equal(select().props.value, 'Old'); assert.equal(select().props.disabled, false);
  releases[1](true); await tick();
  assert.equal(select().props.value, 'Old');
});
test('people picker is a compact popover; Apply preserves existing members and pushes the precise custom field', async () => {
  const f = await fixture('Reviewer');
  assert.match(renderToStaticMarkup(f.render()), /popover="auto"/);
  assert.ok(!renderToStaticMarkup(f.render()).includes('<dialog'));
  nodes(f.render()).find(node => node.props?.popoverTarget).props.onClick();
  const checkboxes = nodes(f.render()).filter(node => node.type === 'input' && node.props.type === 'checkbox');
  assert.equal(checkboxes[0].props.checked, true);
  checkboxes[1].props.onChange({ target: { checked: true } });
  nodes(f.render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(f.calls[0].kind, 'custom'); assert.deepEqual(Array.from(f.calls[0].args[1].reviewer.value), [7, 8]);
  assert.equal(f.calls[0].args[2], true);
  assert.match(renderToStaticMarkup(f.render()), /Original, New/);
  assert.equal(f.hidden, 1, 'Apply closes immediately, before ClickUp finishes');
  assert.equal(nodes(f.render()).find(node => node.props?.popoverTarget).props.disabled, false);
  f.release(true); await tick(); assert.equal(f.hidden, 1);
});
test('Editor and Reviewer can be reopened and changed again while earlier assignment writes are pending', async () => {
  for (const name of ['Editor', 'Reviewer']) {
    const f = await fixture(name), releases = [];
    const key = name.toLowerCase();
    f.plan.fieldSchema.schema.fields.push({ id: key, name, type: 'users' });
    f.action.linkedAdMeta._customFieldsRaw[key] = [7];
    f.action.linkedAdMeta._customFields[key] = 'Original';
    f.plan.saveFields = (...args) => { f.calls.push({ args }); return new Promise(resolve => releases.push(resolve)); };
    const open = () => nodes(f.render()).find(node => node.props?.popoverTarget).props.onClick();
    const checks = () => nodes(f.render()).filter(node => node.type === 'input' && node.props.type === 'checkbox');
    const apply = () => nodes(f.render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
    open(); checks()[1].props.onChange({ target: { checked: true } }); apply();
    assert.equal(f.hidden, 1); assert.equal(releases.length, 1);
    assert.match(renderToStaticMarkup(f.render()), /Original, New/);
    open(); assert.equal(checks()[0].props.checked, true); assert.equal(checks()[1].props.checked, true);
    assert.equal(nodes(f.render()).find(node => node.type === 'fieldset').props.disabled, false);
    checks()[0].props.onChange({ target: { checked: false } }); apply();
    assert.equal(f.hidden, 2); assert.deepEqual(Array.from(f.calls[1].args[1][key].value), [8]);
    open(); assert.equal(checks()[0].props.checked, false); assert.equal(checks()[1].props.checked, true);
    releases[0](false); await tick();
    assert.equal(f.hidden, 2); assert.equal(checks()[0].props.checked, false);
    assert.ok(!nodes(f.render()).some(node => node.props?.role === 'alert'));
    f.action.linkedAdMeta._customFieldsRaw[key] = [8]; f.action.linkedAdMeta._customFields[key] = 'New';
    releases[1](true); await tick();
    assert.equal(f.hidden, 2, 'A completed write must not close a newly reopened picker');
    assert.equal(checks()[1].props.checked, true);
  }
});
test('a rejected assignment save rolls back its label and exposes an error outside the dismissed picker', async () => {
  const f = await fixture('Reviewer');
  nodes(f.render()).find(node => node.props?.popoverTarget).props.onClick();
  nodes(f.render()).filter(node => node.type === 'input' && node.props.type === 'checkbox')[1].props.onChange({ target: { checked: true } });
  const submit = nodes(f.render()).find(node => node.type === 'form').props.onSubmit;
  submit({ preventDefault() {} }); submit({ preventDefault() {} });
  assert.equal(f.calls.length, 1, 'Duplicate submission of the same draft is ignored');
  assert.equal(f.hidden, 1); f.release(false); await tick();
  const trigger = nodes(f.render()).find(node => node.props?.popoverTarget);
  assert.equal(trigger.props.title, 'Original'); assert.equal(trigger.props.disabled, false);
  assert.match(renderToStaticMarkup(f.render()), /Could not save/);
  assert.ok(!nodes(f.render()).some(node => node.type === 'form'));
});
test('plain custom fields remain read-only in the table and editable in the drawer', async () => {
  const table = await fixture('Notes'); assert.equal(table.render().type, 'span');
  const drawer = await fixture('Notes', { detail: true });
  assert.ok(nodes(drawer.render()).find(node => node.props?.popoverTarget));
});
test('dedicated taxonomy columns show local values while the schema loads, then become mapped editors', async () => {
  const f = await fixture('Angle');
  const schema = f.plan.fieldSchema.schema;
  f.plan.fieldSchema.schema = null;
  assert.equal(f.render().props.children, 'Old');
  f.plan.fieldSchema.schema = schema;
  const select = nodes(f.render()).find(node => node.type === 'select');
  assert.equal(select.props['aria-label'], 'Angle for Test');
  select.props.onChange({ target: { value: 'New' } });
  assert.deepEqual(f.calls[0].args[1], { angle: 'New' });
  f.release(true); await tick();
});
test('an older controller without fieldSchema renders safely and recovers when the schema arrives', async () => {
  for (const [name, expected] of [['Angle', 'Old'], ['Persona', 'Existing persona'], ['Reviewer', 'Original']]) {
    const f = await fixture(name);
    f.action.display.persona = 'Existing persona';
    const fields = f.plan.fieldSchema;
    delete f.plan.fieldSchema;
    assert.equal(f.render().type, 'span');
    assert.equal(f.render().props.children, expected);
    assert.equal(f.calls.length, 0);
    f.plan.fieldSchema = fields;
    assert.ok(nodes(f.render()).some(node => node.type === 'select' || node.props?.popoverTarget));
  }
});
test('Action Plan removes form modals and preserves row and task-title access to the side panel', () => {
  const tab = readFileSync('app/command-center/tabs/action-plan-tab.tsx', 'utf8');
  assert.ok(!tab.includes('PlanFieldsDialog')); assert.ok(!tab.includes('PlanCreativeDialog'));
  const table = readFileSync('app/command-center/components/plan-table.tsx', 'utf8');
  assert.match(table, /onClick=\{\(\) => plan\.setSelectedActionId\(d\.dbId\)\}/);
  assert.ok(table.includes("closest('button, input, select, textarea, a, [popover], [role=\"dialog\"]')"));
  const detail = readFileSync('app/command-center/components/plan-task-detail.tsx', 'utf8');
  assert.ok(detail.includes('<PlanTaskDrawer')); assert.ok(detail.includes('<PlanCreativeEditor'));
});
