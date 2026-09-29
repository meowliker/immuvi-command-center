import test from 'node:test';
import assert from 'node:assert/strict';
import { planFieldBinding, planControlValue, planCanonicalPatch } from '../../lib/domain/plan-field-controls.js';
import { planFieldChanges, planPeopleLabel } from '../../lib/domain/action-plan-fields.js';
import { inferClickUpMappings } from '../../lib/domain/clickup-sync.js';
import { TASK_ASSIGNEES_FIELD } from '../../lib/domain/tracker-editing.js';
import { planViewColumns } from '../../lib/domain/action-plan-views.js';

const fields = [TASK_ASSIGNEES_FIELD,
  { id: 'angle', name: 'Angle Tag', type: 'short_text' },
  { id: 'persona', name: 'Persona Tag', type: 'short_text' },
  { id: 'structure', name: 'Creative Structure', type: 'drop_down', type_config: { options: [{ id: 'demo', name: 'Demo', orderindex: 0 }] } },
  { id: 'editor', name: 'Editor', type: 'users' },
  { id: 'reviewer', name: 'Reviewer', type: 'users' },
  { id: 'notes', name: 'Notes', type: 'text' },
  { id: 'spend', name: 'Spend', type: 'number' },
  { id: 'date', name: 'Approved Date', type: 'date' },
  { id: 'formula', name: 'Calculated', type: 'formula' },
  { id: 'parent', name: 'Parent Ad', type: 'text' },
];
const schema = { fields, mappings: inferClickUpMappings(fields), members: [] };
const taxonomy = { angles: ['New angle'], personas: ['New persona'] };
test('legacy taxonomy tags and mapped dropdowns use canonical saves, not raw writes', () => {
  for (const [name, value, expected] of [['Angle Tag', 'New angle', { angle: 'New angle' }], ['Persona Tag', 'New persona', { persona: 'New persona' }], ['Creative Structure', 'Demo', { meta: { creativeStructure: 'Demo' } }]]) {
    const binding = planFieldBinding(name, schema);
    assert.equal(binding.inline, true);
    assert.deepEqual(planCanonicalPatch(binding, value, taxonomy), expected);
  }
  assert.deepEqual(planCanonicalPatch(planFieldBinding('Angle Tag', schema), '', taxonomy), { angle: '' });
  assert.throws(() => planCanonicalPatch(planFieldBinding('Persona Tag', schema), 'Unknown', taxonomy), /existing persona/);
  assert.throws(() => planCanonicalPatch(planFieldBinding('Creative Structure', schema), 'Unknown', taxonomy), /existing option/);
});
test('real Editor and native task assignees stay distinct, with native fallback only when needed', () => {
  assert.equal(planFieldBinding('Editor', schema).field.id, 'editor');
  assert.equal(planFieldBinding('Editor', { ...schema, fields: fields.filter(field => field.id !== 'editor') }).field.id, '__task_assignees');
  const action = { display: {}, linkedAdMeta: { assignees: [{ id: 7 }], _customFieldsRaw: { editor: [8] } } };
  assert.deepEqual(planControlValue(planFieldBinding('Editor', schema), action), ['8']);
  assert.deepEqual(planControlValue(planFieldBinding('Task assignees', schema), action), ['7']);
  assert.equal(planPeopleLabel({ assignees: [{ id: 7 }], _customFieldsRaw: { editor: [] } }, 'editor'), 'Unassigned');
});
test('table inline support matches legacy types and other writable fields belong in the drawer', () => {
  for (const name of ['Editor', 'Reviewer']) assert.equal(planFieldBinding(name, schema).inline, true);
  for (const name of ['Notes', 'Spend', 'Approved Date']) {
    assert.equal(planFieldBinding(name, schema).inline, false);
    assert.equal(planFieldBinding(name, schema).editable, true);
  }
  for (const name of ['Calculated', 'Parent Ad']) assert.equal(planFieldBinding(name, schema).editable, false);
  assert.equal(planFieldBinding('Missing', schema), null);
});
test('custom saves retain exact IDs, typed zero, explicit clears, and multiple people', () => {
  const changes = planFieldChanges(fields, { editor: ['8', '9'], reviewer: [], spend: '0', notes: '', date: '2026-09-28' },
    { editor: [], reviewer: ['7'], spend: '10', notes: 'old', date: '' }, [{ id: 8, username: 'QA editor' }]);
  assert.deepEqual(changes.editor.value, [8, 9]);
  assert.equal(changes.editor.display, 'QA editor, User 9');
  assert.deepEqual(changes.reviewer.value, []);
  assert.equal(changes.spend.value, 0); assert.equal(changes.notes.value, null);
  assert.equal(changes.date.value, Date.parse('2026-09-28T12:00:00Z'));
});
test('empty ClickUp fields are discoverable even without tasks; defaults expose tags and preserve saved layouts', () => {
  const columns = planViewColumns(null, [], fields);
  for (const name of ['angle', 'persona']) assert.equal(columns.find(c => c.key === name).hidden, false);
  for (const name of ['angle tag', 'persona tag']) assert.equal(columns.find(c => c.key === `cf:${name}`).hidden, true);
  assert.equal(columns.find(c => c.key === 'cf:creative structure').hidden, false);
  for (const name of ['notes', 'spend', 'approved date']) assert.ok(columns.find(c => c.key === `cf:${name}`));
  assert.ok(!columns.some(c => ['cf:editor', 'cf:reviewer'].includes(c.key)));
  const saved = { columns: [{ key: 'cf:angle tag', hidden: true, width: 230 }] };
  assert.deepEqual(planViewColumns(saved, [], fields)[0], saved.columns[0]);
});
test('dedicated Angle and Persona editors resolve text-tag mappings as well as exact field names', () => {
  for (const [name, key, value] of [['Angle', 'angle', 'New angle'], ['Persona', 'persona', 'New persona']]) {
    const binding = planFieldBinding(name, schema);
    assert.equal(binding.key, key);
    assert.equal(binding.field.id, key);
    assert.equal(binding.inline, true);
    assert.deepEqual(planCanonicalPatch(binding, value, taxonomy), { [key]: value });
  }
});
