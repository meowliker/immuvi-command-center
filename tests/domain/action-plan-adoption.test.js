import test from 'node:test';
import assert from 'node:assert/strict';
import { virtualPlanActions, promotionArguments, planPresentationKeys, adoptedIdReplacements } from '../../lib/domain/action-plan-adoption.js';
import { filterPlanActions, PLAN_FILTERS, planBatchItems } from '../../lib/domain/action-plan-workspace.js';
import { checkpointReview } from '../../lib/domain/action-plan-checkpoint.js';
const ad = (id, patch = {}) => ({ id, product_id: 'p', format_name: id, status: 'Winner', updated_at: '2026-09-19T10:00:00Z', meta: {}, ...patch });

test('promotion preserves render identity and remaps selection only for a unique same-product link', () => {
  const previous = virtualPlanActions([], [], [ad('a')]);
  const saved = { ...previous[0], display: { ...previous[0].display, dbId: 'real', isVirtual: false } };
  assert.equal(planPresentationKeys(previous).get('va:a'), planPresentationKeys([saved]).get('real'));
  assert.deepEqual([...adoptedIdReplacements(previous, [saved])], [['va:a', 'real']]);
  const duplicate = { ...saved, display: { ...saved.display, dbId: 'second' } };
  assert.equal(adoptedIdReplacements(previous, [saved, duplicate]).size, 0);
  assert.equal(new Set(planPresentationKeys([saved, duplicate]).values()).size, 2);
  assert.equal(adoptedIdReplacements(previous, [{ ...saved, display: { ...saved.display, productId: 'other' } }]).size, 0);
});

test('virtual tasks are deterministic, read-only, versioned and include terminal/app-created creatives', () => {
  const rows = [ad('a'), ad('b', { meta: { _tags: ['app-created'], dueDate: '2026-10-01', notes: 'brief' } })], snapshot = structuredClone(rows);
  const result = virtualPlanActions([], [], rows);
  assert.deepEqual(result.map((a) => a.display.dbId), ['va:a', 'va:b']);
  assert.ok(result.every((a) => a.display.isVirtual && !a.actionVersion && a.adVersion));
  assert.equal(result[1].display.description, 'brief'); assert.equal(result[1].display.dueDate, '2026-10-01');
  assert.deepEqual(rows, snapshot); assert.deepEqual(virtualPlanActions([], [], rows), result);
  assert.equal(filterPlanActions(result, { ...PLAN_FILTERS, includeAdopted: false }).length, 0);
  assert.throws(() => planBatchItems(result), /adopted task/);
});

test('coverage uses explicit IDs, resolved fallback links and ClickUp IDs within each product', () => {
  const rows = [ad('a'), ad('b'), ad('c', { clickup_task_id: 'cu' }), ad('d', { product_id: 'other', clickup_task_id: 'cu' })];
  const records = [{ display: { linkedAdId: 'b', productId: 'p' } }];
  const manual = [{ product_id: 'p', payload: { adId: 'a' } }, { product_id: 'p', payload: { _clickupId: 'cu' } }];
  assert.deepEqual(virtualPlanActions(records, manual, rows).map((a) => a.display.dbId), ['va:d']);
  assert.equal(virtualPlanActions([], [{ product_id: 'p', payload: { adId: 'a', _productBoundaryQuarantined: true } }], [ad('a')]).length, 0);
});

test('deletion, quarantine, removal and duplicate task identities cannot be auto-adopted', () => {
  const rows = [ad('gone', { deleted_at: 'stamp' }), ad('blocked', { meta: { _productBoundaryQuarantined: true } }), ad('tomb'), ad('removed'), ad('dup1', { clickup_task_id: 'cu' }), ad('dup2', { clickup_task_id: 'cu' }), ad('ok')];
  const result = virtualPlanActions([], [], rows, [{ id: 'tomb', product_id: 'p' }], new Set([JSON.stringify(['p', 'removed'])]));
  assert.deepEqual(result.map((a) => a.display.linkedAdId), ['ok']);
});

test('promotion requires a genuine virtual identity, product and creative version; checkpoints become available without a fake DB version', () => {
  const action = virtualPlanActions([], [], [ad('a', { status: 'Testing' })])[0];
  assert.deepEqual(promotionArguments('p', action), { p_product_id: 'p', p_ad_id: 'a', p_expected_updated_at: action.adVersion });
  assert.equal(checkpointReview(action, { phase: 'first' }, { testingDeferCount: 0 }).available, true);
  for (const patch of [{ adVersion: '' }, { display: { ...action.display, productId: 'other' } }, { display: { ...action.display, dbId: 'real' } }, { display: { ...action.display, clickupTaskDeleted: true } }]) {
    assert.throws(() => promotionArguments('p', { ...action, ...patch }), /Reload/);
  }
  const deletedRemote = virtualPlanActions([], [], [ad('remote', { meta: { _clickupTaskDeleted: true } })])[0];
  assert.equal(deletedRemote.display.clickupTaskDeleted, true);
  assert.throws(() => promotionArguments('p', deletedRemote), /Reload/);
});
