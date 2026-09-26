import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

for (const file of ['immuvi-command-center.html', 'public/immuvi-command-center.html']) {
  const html = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  function load(c, start, end) {
    const a = html.indexOf(start), b = html.indexOf(end, a);
    assert.ok(a > 0 && b > a);
    vm.runInContext(html.slice(a, b), c);
  }
  function renderContext() {
    const calls = [];
    const c = vm.createContext({console, document: {querySelector: () => ({id: 'panel-actions'})},
      setTimeout() {throw new Error('Hidden work scheduled');},
      requestIdleCallback() {throw new Error('Hidden work scheduled');}});
    c.window = c;
    for (const name of ['renderProductProfile','renderWinners','updateTabCounts','renderHQ',
      'renderActionPlan','renderInspirations','renderMatrix','renderCreatives','renderProduction']) {
      c[name] = () => {calls.push(name);};
    }
    load(c, 'function _renderAllInternal()', 'function _safeViewTransition(');
    return {c, calls};
  }
  test(file + ': boot renders one tab without scheduling hidden panels', () => {
    const {c, calls} = renderContext();
    c._renderBootTabOnly('actions');
    assert.deepEqual(calls, ['renderProductProfile','renderWinners','updateTabCounts','renderActionPlan']);
    assert.equal(c._renderedTabs.inspiration, undefined);
  });
  test(file + ': refresh invalidates hidden tabs and opening one renders fresh data once', () => {
    const {c, calls} = renderContext();
    c._renderedTabs.matrix = true;
    c._renderAllInternal();
    assert.deepEqual(calls, ['renderProductProfile','renderWinners','renderActionPlan','updateTabCounts']);
    assert.equal(c._renderedTabs.matrix, undefined);
    c._renderTabIfNeeded('matrix');
    c._renderTabIfNeeded('matrix');
    assert.equal(calls.filter(x => x === 'renderMatrix').length, 1);
    c._renderAllInternal();
    c._renderTabIfNeeded('matrix');
    assert.equal(calls.filter(x => x === 'renderMatrix').length, 2);
  });
  test(file + ': deferred and failed rendering remain retryable', () => {
    const {c} = renderContext();
    c.renderInspirations = () => false;
    c._renderTabIfNeeded('inspiration');
    assert.equal(c._renderedTabs.inspiration, undefined);
    c.renderInspirations = () => {};
    c._renderTabIfNeeded('inspiration');
    assert.equal(c._renderedTabs.inspiration, true);
  });
  test(file + ': hidden inspiration updates do no table work and stay invalidated', () => {
    const c = vm.createContext({_renderedTabs: {inspiration: true}, document: {
      getElementById(id) {
        assert.equal(id, 'panel-inspiration');
        return {classList: {contains: () => false}};
      }
    }});
    const a = html.indexOf('function renderInspirations()');
    const b = html.indexOf('  var platform =', a);
    vm.runInContext(html.slice(a, b) + 'throw new Error("Unexpected render");}', c);
    assert.equal(c.renderInspirations(), false);
    assert.equal(c._renderedTabs.inspiration, false);
    assert.match(html, /var r = _origRI\.apply\(this, arguments\);\s*if \(r === false\) return false;/);
  });
  test(file + ': saved suggestions render without peer comparisons or mutations', () => {
    const c = vm.createContext({
      _taxonomySuggestionsForInspiration() {throw new Error('Expensive calculation during render');},
      _taxonomySuggestionFitsActiveProduct: (_, s) => s.name !== 'Foreign',
      _taxonomyItemIsActive: (_, name) => name === 'Existing',
      escAttr: String, esc: String, escJs: String
    });
    load(c, 'function _renderInspirationTaxonomySuggestion(', 'function _taxonomyCreativeCount(');
    const ins = {id: 'INS-1', angle: 'Current', _angleSuggestions: [
      {name:'Current', score:1}, {name:'Foreign', score:0.9, isNew:true},
      {name:'Archived', score:0.8}, {name:'Existing', score:0.7}
    ]};
    const before = JSON.stringify(ins);
    assert.match(c._renderInspirationTaxonomySuggestion(ins, 'angle'), /Suggested: Existing/);
    assert.equal(JSON.stringify(ins), before);
    assert.equal(c._renderInspirationTaxonomySuggestion({id:'empty'}, 'angle'), '');
    assert.match(c._renderInspirationTaxonomySuggestion({id:'new', _personaSuggestions:[
      {name:'New audience', score:0.8, isNew:true}
    ]}, 'persona'), /New: New audience/);
  });
}
