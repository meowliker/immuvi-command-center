import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClickUpImport, clickUpDate, clickUpFieldValue, clickUpStatus, inferClickUpMappings, validateClickUpMappings, QA_CLICKUP_LIST_ID as listId } from '../../lib/domain/clickup-sync.js';

const task = (id = 't1', extra = {}) => ({ id, list: { id: listId }, name: 'Updated name', status: { status: 'mild winner' },
  date_created: '1710000000000', date_updated: '1720000000000', due_date: null, custom_fields: [], ...extra });
const ad = (extra = {}) => ({ id: 'AD-1', product_id: 'qa', clickup_task_id: 't1', status: 'Testing',
  updated_at: '2026-01-01T00:00:00Z', meta: { notes: 'Keep', taskType: 'production', _winningArtifacts: ['winner'], _fromInspoId: 'INS-1' }, ...extra });
const plan = (extra = {}) => buildClickUpImport({ productId: 'qa', listId, tasks: [task()], ads: [], actions: [], tombstones: [], mappings: {}, now: 1800000000000, ...extra });

test('imports use product-scoped identities and ISO database dates', () => {
  const result = plan();
  assert.equal(result.ads[0].id, 'cu:qa:t1');
  assert.equal(result.ads[0].patch.created_at, '2024-03-09T16:00:00.000Z');
  assert.equal(result.ads[0].patch.status, 'Mild Winner');
  assert.equal(typeof result.ads[0].patch.last_status_change_at, 'number');
});
test('existing identities, provenance, notes and winners survive sync', () => {
  const result = plan({ ads: [ad()] });
  assert.equal(result.ads[0].id, 'AD-1');
  assert.equal(result.ads[0].patch.meta.notes, 'Keep');
  assert.deepEqual(result.ads[0].patch.meta._winningArtifacts, ['winner']);
  assert.equal(result.ads[0].patch.meta.taskType, 'production');
  assert.equal(result.ads[0].patch.meta._fromInspoId, 'INS-1');
});
test('sync is idempotent and never removes missing tasks', () => {
  const first = plan();
  const saved = { ...first.ads[0].patch, id: first.ads[0].id, product_id: 'qa', updated_at: '2026-01-01T00:00:00Z' };
  assert.deepEqual(plan({ ads: [saved] }).ads, []);
  assert.deepEqual(plan({ tasks: [], ads: [ad()] }).ads, []);
});
test('tombstones and soft deleted rows block both new and existing tasks', () => {
  assert.equal(plan({ tombstones: [{ product_id: 'qa', id: 'old-id', clickup_task_id: 't1' }] }).skipped, 1);
  assert.equal(plan({ ads: [ad({ deleted_at: '2026-01-01' })] }).ads.length, 0);
  assert.equal(plan({ ads: [ad()], tombstones: [{ product_id: 'qa', id: 'AD-1' }] }).ads.length, 0);
});
test('cross-product inputs, wrong lists and duplicate links fail closed', () => {
  assert.throws(() => plan({ listId: 'production' }), /restricted/);
  assert.throws(() => plan({ tasks: [task('t1', { list: { id: 'production' } })] }), /outside/);
  assert.throws(() => plan({ ads: [ad({ product_id: 'other' })] }), /Cross-product/);
  assert.throws(() => plan({ ads: [ad(), ad({ id: 'AD-2' })] }), /Duplicate/);
});
test('dropdown zero, string indexes, labels, users, booleans and null fields decode correctly', () => {
  const field = { type: 'drop_down', value: 0, type_config: { options: [{ id: 'a', name: 'First', orderindex: '0' }] } };
  assert.equal(clickUpFieldValue(field), 'First');
  assert.equal(clickUpFieldValue({ ...field, value: 'a' }), 'First');
  assert.equal(clickUpFieldValue({ type: 'labels', value: ['a'], type_config: { options: [{ id: 'a', label: 'Label' }] } }), 'Label');
  assert.equal(clickUpFieldValue({ type: 'users', value: [{ username: 'Editor' }] }), 'Editor');
  assert.equal(clickUpFieldValue({ type: 'checkbox', value: false }), 'No');
  assert.equal(clickUpFieldValue({ type: 'text', value: null }), '');
  assert.equal(clickUpFieldValue({ type: 'number', value: 0 }), '0');
  assert.throws(() => clickUpDate('invalid'), /invalid date/);
});
test('mapping prefers text tags, permits intentional unmapping and rejects stale fields', () => {
  const fields = [{ id: 'dd', name: 'Angle' }, { id: 'text', name: 'Angle Tag' }];
  assert.equal(inferClickUpMappings(fields).angle, 'text');
  assert.deepEqual(validateClickUpMappings({ angle: '' }, fields), { angle: '' });
  assert.throws(() => validateClickUpMappings({ angle: 'missing' }, fields), /no longer matches/);
});
test('explicit remote clears propagate, missing fields preserve local values', () => {
  const existing = ad({ angle: 'Local', meta: { dueDate: '2026-01-01', _dueDateMs: 1 } });
  const result = plan({ ads: [existing], mappings: { angle: 'f1' }, tasks: [task('t1', { custom_fields: [{ id: 'f1', name: 'Angle', type: 'text', value: null }] })] });
  assert.equal(result.ads[0].patch.angle, '');
  assert.equal(result.ads[0].patch.meta.dueDate, '');
  assert.equal(Object.hasOwn(plan({ ads: [existing], mappings: { angle: 'f1' } }).ads[0].patch, 'angle'), false);
});
test('recent local status changes cannot be reverted by an older poll', () => {
  assert.equal(plan({ ads: [ad({ status: 'Approved', last_status_change_at: 1800000000000 - 100 })] }).ads[0].patch.status, 'Approved');
});
test('Action Plan fallback repairs identity and propagates name, status, due-date clears', () => {
  const actions = [{ id: 'action-1', product_id: 'qa', updated_at: '2026-01-01', live_status: 'Testing', payload: {
    sourceAdId: 'AD-1', _clickupId: 't1', title: 'Old', notes: 'Preserve', dueDate: '2026-01-01',
  } }];
  const result = plan({ ads: [ad({ clickup_task_id: null })], actions });
  assert.equal(result.ads[0].id, 'AD-1');
  assert.equal(result.actions[0].payload.title, 'Updated name');
  assert.equal(result.actions[0].payload.notes, 'Preserve');
  assert.equal(result.actions[0].payload.dueDate, '');
  assert.throws(() => plan({ ads: [ad({ clickup_task_id: 'another-task' })], actions }), /Conflicting/);
});
test('older remote versions and quarantined creatives are not imported', () => {
  assert.equal(plan({ ads: [ad({ meta: { _clickupUpdatedAt: '2026-01-01' } })] }).skipped, 1);
  assert.equal(plan({ ads: [ad({ meta: { _productBoundaryQuarantined: true } })] }).skipped, 1);
});
test('native statuses use the same spelling as the shared workflow', () => {
  assert.equal(clickUpStatus('ready to launch'), 'Ready to Launch');
  assert.equal(clickUpStatus('in progress'), 'In Production');
  assert.equal(clickUpStatus('mild winner'), 'Mild Winner');
});
test('recent due-date edits are preserved while their ClickUp push is in flight', () => {
  const result = plan({ ads: [ad({ meta: { dueDate: '2026-10-01', _dueDateMs: 123, _dueChangedAt: 1800000000000 - 100 } })] });
  assert.equal(result.ads[0].patch.meta.dueDate, '2026-10-01');
});
test('unacknowledged Tracker edits survive old polls beyond the short grace period', () => {
  const local = ad({ format_name: 'Local name', status: 'Winner', angle: 'Local angle', last_status_change_at: 1,
    meta: { dueDate: '2026-10-01', _dueDateMs: 123, creativeHypothesis: 'Local idea', _customFields: { check: 'No' }, _customFieldsRaw: { check: false },
      _trackerPending: { format_name: 'Local name', status: 'Winner', angle: 'Local angle', dueDate: '2026-10-01', creativeHypothesis: 'Local idea', 'custom:check': false } } });
  const patch = plan({ ads: [local], mappings: { angle: 'angle' }, tasks: [task('t1', { description: 'Creative Hypothesis: Remote', custom_fields: [{ id: 'angle', name: 'Angle', value: 'Remote' }] })] }).ads[0].patch;
  assert.equal(patch.format_name, 'Local name'); assert.equal(patch.status, 'Winner'); assert.equal(patch.angle, 'Local angle');
  assert.equal(patch.meta.dueDate, '2026-10-01'); assert.equal(patch.meta._dueDateMs, 123);
  assert.equal(patch.meta.creativeHypothesis, 'Local idea'); assert.equal(patch.meta._customFieldsRaw.check, false);
});
test('description, hypothesis, assignees and variation fields survive imports', () => {
  const result = plan({ mappings: { variation_number: 'v', parent_ad_id: 'p' }, tasks: [task('t1', {
    description: 'Creative Hypothesis: A new approach\nKeep this brief', assignees: [{ id: 1, username: 'Editor' }],
    custom_fields: [{ id: 'v', name: 'Variation number', value: '2' }, { id: 'p', name: 'Parent ad', value: 'AD-parent' }],
  })] });
  assert.equal(result.ads[0].patch.variation_number, 2);
  assert.equal(result.ads[0].patch.parent_ad_id, 'AD-parent');
  assert.equal(result.ads[0].patch.meta.creativeHypothesis, 'A new approach');
  assert.equal(result.ads[0].patch.meta.assignees[0].username, 'Editor');
  assert.match(result.ads[0].patch.meta.description, /Keep this brief/);
});

test('legacy taxonomy uses populated tags first, dropdowns second, and labeled descriptions last', () => {
  const fields = [
    { id: 'tag', name: 'Angle Tag', type: 'short_text', value: '' },
    { id: 'dd', name: 'Angle', type: 'drop_down', value: 0, type_config: { options: [{ id: 'a', name: 'Dropdown angle', orderindex: 0 }] } },
    { id: 'persona', name: 'Persona Tag', type: 'short_text', value: 'Tagged persona' },
  ];
  const imported = () => plan({ mappings: inferClickUpMappings(fields), tasks: [task('t1', { custom_fields: fields,
    description: 'Angle: Description angle\nPersona: Description persona\nInspiration Link: [Ad](https://example.test/ad)' })] }).ads[0].patch;
  assert.equal(imported().angle, 'Dropdown angle');
  assert.equal(imported().persona, 'Tagged persona');
  assert.equal(imported().ad_link, 'https://example.test/ad');
  fields[0].value = 'Tagged angle'; assert.equal(imported().angle, 'Tagged angle');
  fields[0].value = ''; fields[1].value = null; assert.equal(imported().angle, '', 'An explicit clear must not resurrect an old brief value');
});

test('legacy custom field types and native editor survive import without making extra fields mandatory', () => {
  const custom_fields = [
    { id: 'reviewer', name: 'Reviewer', type: 'users', value: [{ id: 2, username: 'Reviewer' }] },
    { id: 'editor', name: 'Editor', type: 'users', value: [{ id: 3, username: 'Custom editor' }] },
    { id: 'date', name: 'Approved Date', type: 'date', value: '1710000000000' },
    { id: 'revenue', name: 'Revenue', type: 'number', value: 0 },
    { id: 'product', name: 'Product', type: 'drop_down', value: 'p', type_config: { options: [{ id: 'p', name: 'Astro Rekha' }] } },
  ];
  const patch = plan({ tasks: [task('t1', { custom_fields, assignees: [{ id: 1, username: 'Assigned editor' }] })] }).ads[0].patch;
  assert.equal(patch.meta._customFields.editor, 'Custom editor');
  assert.equal(patch.meta._customFields['task assignees'], 'Assigned editor');
  assert.equal(patch.meta._customFields.reviewer, 'Reviewer');
  assert.equal(patch.meta._customFields['approved date'], '2024-03-09');
  assert.equal(patch.meta._customFields.revenue, '0');
  assert.equal(patch.meta._customFields.product, 'Astro Rekha');
  assert.equal(Object.hasOwn(patch, 'variation_number'), false);
});
