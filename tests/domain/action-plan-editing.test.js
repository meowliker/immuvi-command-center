import test from 'node:test';
import assert from 'node:assert/strict';
import { planCreativeValues, planTitleValues, canEditPlanTitle } from '../../lib/domain/action-plan-editing.js';
import { trackerDraft } from '../../lib/domain/tracker-editing.js';

test('plan creative edits reuse diff validation without bypassing status or due workflows', () => {
  const creative = { formatName: 'Brief', status: 'Testing', dueDate: '2026-09-18', notes: 'Keep' };
  assert.deepEqual(planCreativeValues(creative, { ...trackerDraft(creative), formatName: 'New', status: 'Winner', dueDate: '' }), { format_name: 'New' });
  assert.deepEqual(planCreativeValues(creative, { ...trackerDraft(creative), notes: '' }), { meta: { notes: '' } });
  assert.throws(() => planCreativeValues(creative, { ...trackerDraft(creative), driveLink: 'javascript:alert(1)' }), /HTTP/);
});
test('plan names are trimmed, bounded and nonempty', () => {
  assert.deepEqual(planTitleValues('  New name  '), { format_name: 'New name' });
  for (const name of ['', '  ', 'a'.repeat(501)]) assert.throws(() => planTitleValues(name), /1 to 500/);
});
test('plan editing requires explicit source identity or an unlinked standalone action', () => {
  const action = { payload: { sourceAdId: 'a' }, display: { linkedAdId: 'a', clickupTaskId: '' } };
  assert.equal(canEditPlanTitle(action), true);
  assert.equal(canEditPlanTitle({ ...action, payload: {} }), false);
  assert.equal(canEditPlanTitle({ payload: {}, display: { linkedAdId: '', clickupTaskId: '' } }), true);
  assert.equal(canEditPlanTitle({ payload: {}, display: { linkedAdId: '', clickupTaskId: 'remote' } }), false);
});
