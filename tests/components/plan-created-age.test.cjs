const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

const moduleUnderTest = { exports: {} };
const source = ts.transpileModule(readFileSync('app/command-center/helpers/format.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
runInNewContext(source, { module: moduleUnderTest, exports: moduleUnderTest.exports, require: () => ({}) });
const { formatCreatedAge } = moduleUnderTest.exports;
const now = Date.parse('2026-09-28T00:15:00Z');

test('Created uses elapsed minutes, hours, days, and weeks at exact boundaries', () => {
  for (const [seconds, expected] of [
    [0, 'now'], [59, 'now'], [60, '1m'], [3599, '59m'],
    [3600, '1h'], [7200, '2h'], [86399, '23h'],
    [86400, '1d'], [172800, '2d'], [604799, '6d'],
    [604800, '1w'], [1209600, '2w'], [2592000, '4w'], [31536000, '52w'],
  ]) assert.equal(formatCreatedAge(now - seconds * 1000, now), expected);
});
test('Created handles absent dates and clock skew, and advances as the plan clock updates', () => {
  for (const value of [undefined, null, 0, NaN, Infinity]) assert.equal(formatCreatedAge(value, now), '-');
  assert.equal(formatCreatedAge(now + 1000, now), 'now');
  const created = now - 3599_000;
  assert.equal(formatCreatedAge(created, now), '59m');
  assert.equal(formatCreatedAge(created, now + 1000), '1h');
});
test('Action Plan Created uses the live clock and retains its full-date tooltip', () => {
  const table = readFileSync('app/command-center/components/plan-table.tsx', 'utf8');
  assert.match(table, /title=\{formatDateTime\(d\.createdAt\) \|\| undefined\}/);
  assert.ok(table.includes('formatCreatedAge(d.createdAt, now)'));
  assert.ok(!table.includes('cellRelativeDate'));
});
