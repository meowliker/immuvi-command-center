import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

for (const file of ['immuvi-command-center.html', 'public/immuvi-command-center.html']) {
  const html = readFileSync(new URL('../' + file, import.meta.url), 'utf8');

  test(file + ': angle and persona picker stays open while its option list scrolls', () => {
    let closed = 0;
    const panel = {contains(target) { return target === 'list' || target === 'option'; }};
    const context = vm.createContext({
      _apTagPopState: {panel},
      apCloseTagDropdown() { closed += 1; },
    });
    const start = html.indexOf('function _apTagPopScroll(');
    assert.ok(start >= 0);
    vm.runInContext(html.slice(start, html.indexOf('\n}', start) + 2), context);

    context._apTagPopScroll({target: 'list'});
    context._apTagPopScroll({target: 'option'});
    context._apTagPopScroll({target: panel});
    assert.equal(closed, 0);

    context._apTagPopScroll({target: 'page'});
    assert.equal(closed, 1);
  });

  test(file + ': picker installs and removes the guarded scroll handler', () => {
    assert.match(html, /window\.addEventListener\('scroll', _apTagPopScroll, true\)/);
    assert.match(html, /window\.removeEventListener\('scroll', _apTagPopScroll, true\)/);
    assert.doesNotMatch(html, /window\.addEventListener\('scroll', apCloseTagDropdown, true\)/);
  });
}
