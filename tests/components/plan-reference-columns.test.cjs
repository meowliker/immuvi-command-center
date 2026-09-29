const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

async function render(meta = {}, linked = true) {
  const modules = {};
  for (const file of ['action-plan-views', 'action-plan-presentation', 'action-plan']) modules[file] = await import(`../../lib/domain/${file}.js`);
  const module = { exports: {} };
  const source = ts.transpileModule(readFileSync('app/command-center/components/plan-table.tsx', 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  }).outputText;
  runInNewContext(source, { module, exports: module.exports, require: id => {
    if (id === 'react') return { ...React, useState: () => [null, () => {}] };
    if (id.endsWith('.css')) return { default: new Proxy({}, { get: (_, key) => key }) };
    for (const [file, value] of Object.entries(modules)) if (id.endsWith(`/${file}.js`)) return value;
    if (id.endsWith('plan-column-resizer')) return { PlanColumnResizer: () => null };
    if (id.endsWith('plan-workflow')) return { creationLocked: () => false };
    if (id.startsWith('.')) return {};
    return require(id);
  } });
  const action = { display: { dbId: 'a', productId: 'qa', title: 'Creative', status: 'Untested', source: { kind: 'inspo', label: 'INS-1' }, clickupTaskId: linked ? 'task' : '' }, linkedAdMeta: meta, payload: {} };
  return renderToStaticMarkup(React.createElement(module.exports.PlanTable, {
    rows: [action], columns: ['origin', 'brief', 'adSource', 'driveLink'].map(key => ({ key, width: 180 })),
    plan: { bulk: { selectedIds: [] }, creationJobs: [], presentationKeys: new Map([['a', 'a']]), ageAds: [], inspirations: [
      { id: 'INS-1', product_id: 'qa', title: 'Inspiration title', url: 'https://example.test/ad', data: { _clickupDocPageUrl: 'https://example.test/brief' } },
    ] }, sort: {}, ages: new Map(), visibility: { hiddenIds: new Set() }, deletion: {}, repair: {},
  }));
}

test('Origin has one source chip while Brief, Ad source and Drive Link have separate cells', async () => {
  const html = await render({ _fromInspoId: 'INS-1', _customFields: { 'drive link': 'https://drive.google.com/folder' } });
  const origin = html.match(/<td data-plan-cell="origin"[^>]*>(.*?)<\/td>/)[1];
  assert.equal((origin.match(/<a /g) || []).length, 1);
  assert.ok(origin.includes('Inspiration title'));
  for (const [key, label, url] of [
    ['brief', 'Brief', 'https://example.test/brief'],
    ['adSource', 'Ad source', 'https://example.test/ad'],
    ['driveLink', 'Drive Link', 'https://drive.google.com/folder'],
  ]) {
    const cell = html.match(new RegExp(`<td data-plan-cell="${key}"[^>]*>(.*?)<\\/td>`))[1];
    assert.ok(cell.includes(`href="${url}"`));
    assert.ok(cell.includes(`aria-label="${label} for Creative"`));
    assert.ok(cell.includes('target="_blank"'));
  }
});

test('missing reference URLs render a dash, without fake links', async () => {
  const html = await render({}, false);
  for (const key of ['brief', 'adSource', 'driveLink']) assert.ok(html.includes(`<td data-plan-cell="${key}">-</td>`));
});
