const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const postcss = require('postcss');

test('worker selector moves focus indication to the enclosing control without changing its size', () => {
  const css = postcss.parse(readFileSync('app/command-center/inspiration.module.css', 'utf8'));
  const declarations = selector => {
    const values = {};
    css.walkRules(selector, rule => rule.walkDecls(decl => { values[decl.prop] = decl.value; }));
    return values;
  };
  const focus = declarations('.runOn:focus-within');
  assert.equal(focus['border-color'], '#3e86c6');
  assert.notEqual(focus['box-shadow'], 'none');
  assert.equal(focus['border-width'], undefined);
  assert.equal(focus.padding, undefined);
  assert.equal(declarations('.runOn select:focus').outline, 'none');
});
