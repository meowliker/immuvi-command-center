import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTION_COLUMNS, productionBucket, productionDropStatus } from '../../lib/domain/production.js';

test('Production groups resolved statuses, including terminal mild winners and killed tasks', () => {
  assert.deepEqual(PRODUCTION_COLUMNS.map((column) => column.id), ['queue', 'progress', 'done']);
  for (const status of ['Winner', 'Mild Winner', 'Scale', 'Complete', 'Loser', 'Killed', ' winner ']) assert.equal(productionBucket(status), 'done');
  for (const status of ['In Production', 'Ready to Launch', 'Testing']) assert.equal(productionBucket(status), 'progress');
  for (const status of ['Untested', 'Approved', 'Assigned', 'Custom queue', '', null]) assert.equal(productionBucket(status), 'queue');
});

test('column moves use canonical statuses but same-column drops never downgrade a task', () => {
  assert.equal(productionDropStatus('Approved', 'progress'), 'In Production');
  assert.equal(productionDropStatus('Testing', 'done'), 'Complete');
  assert.equal(productionDropStatus('Complete', 'queue'), 'Untested');
  for (const status of ['Approved', 'Testing', 'Winner', 'Mild Winner']) assert.equal(productionDropStatus(status, productionBucket(status)), null);
  assert.throws(() => productionDropStatus('Testing', 'invalid'), /Unknown production column/);
});
