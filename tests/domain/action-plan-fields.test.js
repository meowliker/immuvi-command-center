import test from 'node:test';
import assert from 'node:assert/strict';
import { planEditableFields, planFieldDraft, planFieldChanges, planPeopleLabel } from '../../lib/domain/action-plan-fields.js';
import { TASK_ASSIGNEES_FIELD } from '../../lib/domain/tracker-editing.js';
const fields = [TASK_ASSIGNEES_FIELD, { id: 'review', name: 'Reviewer', type: 'users' }, { id: 'score', name: 'Score', type: 'number' }, { id: 'check', name: 'Checked', type: 'checkbox' }];
test('Action Plan fields exclude canonical names and configured mappings but retain native assignees', () => {
  assert.deepEqual(planEditableFields({ fields: [...fields, { id: 'angle', name: ' Angle Tag ', type: 'text' }, { id: 'custom', name: 'Alias', type: 'text' }], mappings: { persona: 'custom' } }), fields);
});
test('Action Plan assignment drafts retain unknown members and explicit clears', () => {
  const draft = planFieldDraft(fields, { assignees: [], _customFieldsRaw: { editor: [9], reviewer: [{ id: 4 }, 5], score: 0, checked: false } });
  assert.deepEqual(draft, { __task_assignees: [], review: ['4', '5'], score: '0', check: false });
  assert.deepEqual(planFieldChanges(fields, draft, draft, []), {});
  assert.deepEqual(planFieldDraft([TASK_ASSIGNEES_FIELD], { _customFieldsRaw: { editor: [{ id: 7 }] } }), { __task_assignees: ['7'] });
});
test('field changes preserve typed zero/false and create readable people mirrors', () => {
  const baseline = planFieldDraft(fields, {});
  const changes = planFieldChanges(fields, { ...baseline, __task_assignees: ['4'], review: ['5'], score: '0' }, baseline, [{ id: 4, username: 'QA Editor' }]);
  assert.deepEqual(changes.__task_assignees.value, [4]); assert.equal(changes.__task_assignees.display, 'QA Editor');
  assert.equal(changes.review.display, 'User 5'); assert.equal(changes.score.value, 0); assert.equal(changes.check, undefined);
  const clear = planFieldChanges(fields, { ...baseline, check: false }, { ...baseline, check: true, review: ['5'] }, []);
  assert.equal(clear.check.value, false); assert.deepEqual(clear.review.value, []);
});
test('people labels respect authoritative clears and native assignees without custom mirrors', () => {
  assert.equal(planPeopleLabel({ assignees: [], _customFields: { editor: 'Old user' } }, 'editor'), 'Unassigned');
  assert.equal(planPeopleLabel({ assignees: [{ id: 7, username: 'QA' }, 8] }, 'editor'), 'QA, User 8');
  assert.equal(planPeopleLabel({ _customFieldsRaw: { reviewer: [7] }, _customFields: { reviewer: 'QA reviewer' } }, 'reviewer'), 'QA reviewer');
  assert.equal(planPeopleLabel({ assignees: [{ id: 8, username: 'New editor' }], _customFieldsRaw: { 'task assignees': [7] }, _customFields: { 'task assignees': 'Old editor' } }, 'editor'), 'New editor');
});
