import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { matchingClickUpStatus } from '../../lib/domain/clickup-statuses.js';

function fixture(statuses, failure = false) {
  const calls = [];
  const module = { exports: {} };
  const source = ts.transpileModule(readFileSync(new URL('../../app/command-center/services/actions.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  runInNewContext(source, { module, exports: module.exports, require(id) {
    if (id.endsWith('clickup-statuses.js')) return { matchingClickUpStatus };
    if (id.endsWith('action-plan-workflow.js')) return { savePlanWorkflow: async (...args) => {
      calls.push(['save', args[4]]); return { linkedAdId: 'ad', taskId: 'task' };
    } };
    if (id === './qa-clickup') return { requestQaClickUp: async (_, __, input) => {
      calls.push([input.operation]);
      if (input.operation === 'plan-statuses') return { statuses };
      return { pushed: failure ? 0 : 1, failed: failure ? [{ field: 'status', error: 'Read-back failed' }] : [] };
    } };
    throw new Error(`Unexpected import: ${id}`);
  } });
  return { ...module.exports, calls };
}
const action = { display: { dbId: 'action', clickupTaskId: 'task' } };

test('unsupported linked status fails before any local save or remote write', async () => {
  const f = fixture([{ status: 'testing' }]);
  await assert.rejects(f.persistActionStatus({}, 'qa', action, 'Assigned'), /not available/);
  assert.deepEqual(f.calls, [['plan-statuses']]);
});
test('valid linked status is saved then pushed; failed confirmation remains a warning', async () => {
  for (const failure of [false, true]) {
    const f = fixture([{ status: 'testing' }], failure);
    const result = await f.persistActionStatus({}, 'qa', action, 'Testing');
    assert.deepEqual(f.calls, [['plan-statuses'], ['save', 'Testing'], ['push-creative']]);
    if (failure) assert.match(result.clickUpWarning, /remain pending/);
    else assert.equal(result.clickUpWarning, '');
  }
});
