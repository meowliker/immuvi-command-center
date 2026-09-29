import test from 'node:test';
import assert from 'node:assert/strict';
import { matchingClickUpStatus, listWorkflowStatuses } from '../../lib/domain/clickup-statuses.js';

const statuses = ['untested', 'approved', 'in production', 'testing', 'complete'].map(status => ({ status }));
test('linked-list choices exclude unsupported app defaults and preserve list order', () => {
  assert.deepEqual(listWorkflowStatuses(statuses), ['Untested', 'Approved', 'In Production', 'Testing', 'Complete']);
  assert.throws(() => matchingClickUpStatus('Assigned', statuses), /not available/);
  assert.throws(() => matchingClickUpStatus('Testing', []), /not available/);
  assert.equal(matchingClickUpStatus('Testing', statuses), 'testing');
});
test('import aliases round trip without substituting an unrelated status', () => {
  assert.equal(matchingClickUpStatus('In Production', [{ status: 'in progress' }]), 'in progress');
  assert.equal(matchingClickUpStatus('Complete', [{ status: 'done' }]), 'done');
  assert.throws(() => matchingClickUpStatus('Assigned', [{ status: 'approved' }]), /not available/);
});
