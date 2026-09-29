import test from 'node:test';
import assert from 'node:assert/strict';
import { trackerDraft, trackerSaveValues, parseWinningFile, safeCreativeUrl, customFieldInputValue, validateCustomFieldValue, changedCustomFields } from '../../lib/domain/tracker-editing.js';

test('tracker edits patch only changed values and preserve explicit clears', () => {
  const before = trackerDraft({ formatName: 'Test', angle: 'Energy', creativeHypothesis: 'Original' });
  assert.deepEqual(trackerSaveValues({ ...before, angle: '', creativeHypothesis: '' }, before), { angle: '', meta: { creativeHypothesis: '' } });
  assert.deepEqual(trackerSaveValues(before, before), {});
  const due = trackerSaveValues({ ...before, dueDate: '2026-10-01' }, before);
  assert.equal(due.meta.dueDate, '2026-10-01');
  assert.ok(Number.isFinite(due.meta._dueDateMs));
  assert.deepEqual(trackerSaveValues({ ...before, dueDate: '' }, { ...before, dueDate: '2026-10-01' }).meta, { dueDate: '', _dueDateMs: null });
});
test('invalid names, links, dates, and non-file Drive inputs fail without unsafe URLs', () => {
  const draft = trackerDraft({ formatName: 'Test' });
  for (const patch of [{ formatName: ' ' }, { adLink: 'javascript:alert(1)' }, { dueDate: '2026-99-99' }, { dueDate: '2026-02-30' }]) {
    assert.throws(() => trackerSaveValues({ ...draft, ...patch }));
  }
  assert.equal(safeCreativeUrl('javascript:alert(1)'), '');
  for (const url of ['https://evil.test/d/id', 'https://drive.google.com/drive/folders/id', 'https://drive.google.com']) assert.throws(() => parseWinningFile(url));
  assert.deepEqual(parseWinningFile('https://drive.google.com/file/d/file-1/view', 'Output'), { id: 'file-1', name: 'Output', url: 'https://drive.google.com/file/d/file-1/view' });
});
test('custom field values distinguish zero, false, cleared values and dropdown orderindex zero', () => {
  const dropdown = { id: 'dd', name: 'Choice', type: 'drop_down', type_config: { options: [{ id: 'first', orderindex: 0 }] } };
  assert.equal(customFieldInputValue(dropdown, 0), 'first');
  assert.equal(validateCustomFieldValue(dropdown, 'first'), 'first');
  assert.throws(() => validateCustomFieldValue(dropdown, 'missing'));
  assert.equal(validateCustomFieldValue({ type: 'number' }, '0'), 0);
  assert.equal(validateCustomFieldValue({ type: 'checkbox' }, false), false);
  assert.equal(validateCustomFieldValue({ type: 'date' }, ''), null);
  assert.deepEqual(validateCustomFieldValue({ type: 'users' }, ['12']), [12]);
  assert.throws(() => validateCustomFieldValue({ type: 'users' }, ['bad']));
  assert.throws(() => validateCustomFieldValue({ type: 'date' }, '2026-02-30'));
  assert.deepEqual(changedCustomFields([dropdown], { dd: 'first' }, { dd: 'first' }), {});
  assert.deepEqual(changedCustomFields([dropdown], { dd: '' }, { dd: 'first' }), { dd: { name: 'Choice', type: 'drop_down', value: null } });
});
