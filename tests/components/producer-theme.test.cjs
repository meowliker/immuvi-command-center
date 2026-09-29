const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const postcss = require('postcss');

const css = postcss.parse(readFileSync('app/command-center.module.css', 'utf8'));
const legacy = postcss.parse(readFileSync('immuvi-command-center.html', 'utf8').match(/:root\s*\{[^}]+\}/)[0]);
function properties(root, selector) {
  const result = {};
  root.walkRules(selector, rule => rule.walkDecls(declaration => { result[declaration.prop] = declaration.value; }));
  return result;
}
test('image-generation dialog inherits the legacy text and primary-action palette within its own scope', () => {
  const old = properties(legacy, ':root'), current = properties(css, '.producerDialog');
  for (const [token, legacyToken] of [['--producer-text', '--t1'], ['--producer-muted', '--t2'], ['--producer-subtle', '--t3'], ['--producer-primary', '--inprog']]) {
    assert.equal(current[token], old[legacyToken].toLowerCase());
  }
  assert.equal(properties(css, ".producerForm footer button[type='submit']").background, 'var(--producer-primary)');
  assert.equal(properties(css, '.producerDialog::backdrop').background, 'rgba(0,0,0,.45)');
});
test('producer theme retains disabled and focus states and highlights selected suggestions', () => {
  assert.equal(properties(css, '.producerForm button:disabled').opacity, '.5');
  assert.equal(properties(css, '.producerDialog :is(input, textarea, select, button, a):focus-visible').outline, '2px solid var(--producer-primary)');
  assert.equal(properties(css, '.producerSuggestion:has(input:checked)').background, 'rgba(99,102,241,.07)');
  const dialog = readFileSync('app/command-center/components/plan-producer-dialog.tsx', 'utf8');
  assert.ok(dialog.includes('disabled={busy||active||!eligible}'));
});
