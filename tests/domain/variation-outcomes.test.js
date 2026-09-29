import test from 'node:test';
import assert from 'node:assert/strict';
import { variationOutcomes } from '../../lib/domain/variation-outcomes.js';

test('Variation breakdown preserves legacy outcome buckets without relabeling unknown statuses as pending', () => {
  const statuses = ['Winner', 'Scale', 'Loser', 'Complete', 'Testing', 'In Production', 'Ready to Launch', 'Untested', '', 'Mild Winner', 'Approved'];
  assert.deepEqual(variationOutcomes(statuses.map((status) => ({ status }))), { winners: 2, losers: 2, testing: 3, pending: 2, other: 2 });
  assert.deepEqual(variationOutcomes([]), { winners: 0, losers: 0, testing: 0, pending: 0, other: 0 });
});
