import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const files = ['immuvi-command-center.html', 'public/immuvi-command-center.html'];

function cell(key) {
  const classes = new Set(['existing-class']);
  return {
    classes,
    scrolls: 0,
    getAttribute: () => key,
    classList: { toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); } },
    scrollIntoView() { this.scrolls++; }
  };
}

async function setup(file) {
  const html = await readFile(file, 'utf8');
  const start = html.indexOf('var _mxv4CreativeSearch =');
  const end = html.indexOf('function renderMxv4Filters()', start);
  assert.ok(start > 0 && end > start);
  const cells = [cell('Angle A||Beginner'), cell('Angle B||Beginner'), cell('Angle C||Seller')];
  const count = { textContent: '' };
  const jump = { disabled: true };
  const root = { querySelectorAll: () => cells };
  const context = vm.createContext({
    activeProductId: 'quilting',
    ADS: [
      { id: 'AD-1', taskName: 'Q-14021', formatName: 'Fabric Choice Confidence', product_id: 'quilting' },
      { id: 'AD-2', taskName: 'Q-14022', formatName: 'Beginner Guide', _clickupId: '86abc' },
      { id: 'AD-3', taskName: 'Foreign Creative', product_id: 'therapy' },
      { id: 'AD-4', taskName: 'Quarantined Creative', quarantined: true },
      { id: 'AD-5', taskName: 'Deleted Creative', deleted_at: '2026-09-15' }
    ],
    CELL_CREATIVE_ASSIGNMENTS: {
      'Angle A||Beginner': ['AD-1', 'AD-2'],
      'Angle B||Beginner': ['AD-1'],
      'Angle C||Seller': ['AD-3', 'AD-4', 'AD-5', 'missing']
    },
    MATRIX_CELL_META: { 'AD-1||Angle B||Beginner': { uniqueName: '14021-2' } },
    _adPassesProductBoundaryForTaxonomy: ad => !ad.quarantined,
    document: { getElementById: id => ({ matrixGrid: root, mxCreativeSearchCount: count, mxCreativeSearchJump: jump })[id] },
    renderMatrix() { throw new Error('Typing must not redraw the matrix'); },
    saveState() { throw new Error('Search must not save data'); }
  });
  vm.runInContext(html.slice(start, end), context);
  context._mxv4BuildSearchIndex();
  return { context, cells, count, jump, html };
}

for (const file of files) {
  test(`${file}: name and ID search highlights every assigned cell without rebuilding`, async () => {
    const { context: c, cells, count, jump } = await setup(file);
    c.setMxv4CreativeSearch('  FABRIC\t choice  ');
    assert.equal(count.textContent, '2 matching cells');
    assert.equal(jump.disabled, false);
    assert.deepEqual(cells.map(el => el.classes.has('mx-search-match')), [true, true, false]);
    c.setMxv4CreativeSearch('q-14021');
    assert.equal(count.textContent, '2 matching cells');
    c._mxv4NextSearchMatch();
    c._mxv4NextSearchMatch();
    c._mxv4NextSearchMatch();
    assert.deepEqual(cells.map(el => el.scrolls), [2, 1, 0]);
    c.setMxv4CreativeSearch('14021-2');
    assert.deepEqual(cells.map(el => el.classes.has('mx-search-match')), [false, true, false]);
    c.setMxv4CreativeSearch('86abc');
    assert.deepEqual(cells.map(el => el.classes.has('mx-search-match')), [true, false, false]);
  });

  test(`${file}: excludes foreign, deleted, missing and quarantined records`, async () => {
    const { context: c, count } = await setup(file);
    for (const query of ['Foreign', 'Quarantined', 'Deleted', 'missing', 'fabric guide']) {
      c.setMxv4CreativeSearch(query);
      assert.equal(count.textContent, 'No matching cells', query);
    }
  });

  test(`${file}: clear and product switching remove stale highlights`, async () => {
    const { context: c, cells, count, jump } = await setup(file);
    c.setMxv4CreativeSearch('fabric');
    c.setMxv4CreativeSearch('');
    assert.equal(count.textContent, '');
    assert.equal(jump.disabled, true);
    assert.ok(cells.every(el => !el.classes.has('mx-search-match') && el.classes.has('existing-class')));
    c.setMxv4CreativeSearch('fabric');
    c.activeProductId = 'therapy';
    c._mxv4BuildSearchIndex();
    c._mxv4ApplyCreativeSearch();
    assert.equal(c._mxv4SearchState().query, '');
    assert.ok(cells.every(el => !el.classes.has('mx-search-match')));
  });

  test(`${file}: refresh rebuilds membership and preserves the current query`, async () => {
    const { context: c, cells, count } = await setup(file);
    c.setMxv4CreativeSearch('fabric');
    c.CELL_CREATIVE_ASSIGNMENTS['Angle A||Beginner'] = ['AD-2'];
    c._mxv4BuildSearchIndex();
    c._mxv4ApplyCreativeSearch();
    assert.equal(c._mxv4SearchState().query, 'fabric');
    assert.equal(count.textContent, '1 matching cell');
    assert.deepEqual(cells.map(el => el.classes.has('mx-search-match')), [false, true, false]);
  });

  test(`${file}: inline JavaScript parses and render hooks are present`, async () => {
    const { html } = await setup(file);
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc\s*=|type\s*=\s*["'](?:module|application\/ld\+json)/i.test(match[1])) continue;
      new vm.Script(match[2]);
    }
    assert.match(html, /data-mx-search-key=/);
    assert.match(html, /el\.innerHTML = html;\s*_mxv4BuildSearchIndex\(\);\s*_mxv4ApplyCreativeSearch\(\);/);
    assert.match(html, /oninput="setMxv4CreativeSearch\(this\.value\)"/);
  });
}
