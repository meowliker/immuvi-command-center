import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlanEditQueue, projectPlanEdits } from '../../lib/services/plan-edit-queue.js';
import { applyPlanEdit, rebasePlanEdit } from '../../lib/domain/plan-edit-patches.js';

const action = { display: { dbId: 'action', productId: 'qa', linkedAdId: 'ad', clickupTaskId: 'task', angle: 'Old', persona: 'Original', status: 'Untested' },
  payload: { sourceAdId: 'ad' }, linkedAdMeta: {}, actionVersion: 'a1', adVersion: 'v1' };
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  let pending = [], tail = Promise.resolve();
  const errors = [], notices = [];
  const queue = createPlanEditQueue({ changed: value => { pending = value; }, failed: message => errors.push(message), completed: message => notices.push(message) });
  const schedule = fn => () => { const work = tail.then(fn); tail = work.catch(() => {}); return work; };
  return { queue, schedule, errors, notices, get pending() { return pending; }, project: () => projectPlanEdits([action], pending)[0] };
}
test('rapid angle/persona/status edits project immediately, serialize versions, and notify once after ClickUp', async () => {
  const f = fixture(), remote = deferred(), seen = [];
  const edits = [{ kind: 'creative', values: { angle: 'New' } }, { kind: 'creative', values: { persona: 'Parents' } },
    { kind: 'creative', values: { angle: 'Latest' } }, { kind: 'status', value: 'Testing', changedAt: 123 }];
  const works = edits.map((edit, index) => f.queue.run(action, edit, async (baseline, remember) => {
    seen.push(baseline);
    remember({ ...applyPlanEdit(baseline, edit), adVersion: `v${index + 2}` });
    if (!index) await remote.promise;
  }, f.schedule));
  await tick();
  assert.equal(f.project().display.angle, 'Latest');
  assert.equal(f.project().display.persona, 'Parents');
  assert.equal(f.project().display.status, 'Testing');
  assert.equal(seen.length, 1); assert.deepEqual(f.notices, []);
  remote.resolve(); assert.deepEqual(await Promise.all(works), [true, true, true, true]);
  assert.equal(seen[1].adVersion, 'v2'); assert.equal(seen[2].display.persona, 'Parents');
  assert.equal(seen[3].display.angle, 'Latest'); assert.equal(f.pending.length, 0);
  assert.deepEqual(f.notices, ['Task successfully updated.']);
});
test('a failed save rolls back only its overlay and does not drop subsequent edits or report success', async () => {
  const f = fixture(), wait = deferred();
  const first = f.queue.run(action, { kind: 'creative', values: { angle: 'Bad' } }, async () => { await wait.promise; throw new Error('Field unavailable'); }, f.schedule);
  const second = f.queue.run(action, { kind: 'creative', values: { persona: 'Parents' } }, async (baseline, remember) => {
    assert.equal(baseline.display.angle, 'Old'); remember(applyPlanEdit(baseline, { kind: 'creative', values: { persona: 'Parents' } }));
  }, f.schedule);
  wait.resolve(); assert.deepEqual(await Promise.all([first, second]), [false, true]);
  assert.deepEqual(f.errors, ['Field unavailable']); assert.deepEqual(f.notices, []);
});
test('ClickUp failure retains a locally saved value, reports a warning, and allows the next edit', async () => {
  const f = fixture();
  const saved = await f.queue.run(action, { kind: 'creative', values: { angle: 'New' } }, async (baseline, remember) => {
    remember(applyPlanEdit(baseline, { kind: 'creative', values: { angle: 'New' } }));
    throw new Error('Saved in QA. ClickUp changes remain pending: timeout');
  }, f.schedule);
  assert.equal(saved, true); assert.match(f.errors[0], /pending/); assert.equal(f.pending.length, 0); assert.deepEqual(f.notices, []);
  await f.queue.run(action, { kind: 'due', value: '' }, async (baseline, remember) => remember(baseline), f.schedule);
  assert.deepEqual(f.notices, ['Task successfully updated.']);
});
test('disposing a product queue skips waiting edits and suppresses late notifications', async () => {
  const f = fixture(), wait = deferred(); let writes = 0;
  const first = f.queue.run(action, { kind: 'due', value: '' }, async (baseline, remember) => { writes++; await wait.promise; remember(baseline); }, f.schedule);
  const next = f.queue.run(action, { kind: 'status', value: 'Testing' }, async () => { writes++; }, f.schedule);
  await tick(); f.queue.dispose(); wait.resolve(); await Promise.all([first, next]);
  assert.equal(writes, 1); assert.deepEqual(f.notices, []);
});
test('rebasing preserves unrelated changes and ClickUp acknowledgements but rejects same-field or identity conflicts', () => {
  const edit = { kind: 'creative', values: { angle: 'New' } };
  const current = { ...action, adVersion: 'ack-version', display: { ...action.display, persona: 'Someone else changed this' } };
  assert.equal(rebasePlanEdit(action, current, edit), current);
  assert.throws(() => rebasePlanEdit(action, { ...current, display: { ...current.display, angle: 'Peer edit' } }, edit), /changed elsewhere/);
  for (const patch of [{ productId: 'production' }, { linkedAdId: 'other' }, { clickupTaskId: 'other' }, { dbId: 'other' }]) {
    assert.throws(() => rebasePlanEdit(action, { ...current, display: { ...current.display, ...patch } }, edit), /identity changed/);
  }
  assert.throws(() => rebasePlanEdit(action, { ...current, payload: { sourceAdId: 'other' } }, edit), /identity changed/);
});
test('custom fields project typed values and detect peer conflicts without touching unrelated assignments', () => {
  const edit = { kind: 'fields', values: { reviewer: { name: 'Reviewer', value: [7], display: 'Anay' } } };
  const projected = applyPlanEdit(action, edit);
  assert.deepEqual(projected.linkedAdMeta._customFieldsRaw.reviewer, [7]);
  assert.equal(projected.linkedAdMeta._customFields.reviewer, 'Anay');
  assert.throws(() => rebasePlanEdit(action, projected, edit), /changed elsewhere/);
  assert.deepEqual(action.linkedAdMeta, {});
});
