import test from 'node:test';
import assert from 'node:assert/strict';
import { saveClickUpPresenceIdentity } from '../../lib/services/clickup-presence.js';

test('presence stores only the verified name and IDs, never email or credentials', async () => {
  const db = { from(table) { assert.equal(table, 'qa_clickup_identities'); return { async upsert(row, options) {
    assert.deepEqual(row, { user_id: 'app-user', clickup_user_id: '42', name: 'ClickUp Name' });
    assert.equal(options.onConflict, 'user_id,clickup_user_id'); return { error: null };
  } }; } };
  await saveClickUpPresenceIdentity(db, 'app-user', { id: 42, name: ' ClickUp Name ', email: 'private@example.test', token: 'never-store' });
});

test('invalid identities and failed persistence cannot claim verified presence', async () => {
  await assert.rejects(saveClickUpPresenceIdentity({}, 'app-user', { id: '42', name: '' }), /verified/);
  const db = { from: () => ({ upsert: async () => ({ error: { message: 'internal' } }) }) };
  await assert.rejects(saveClickUpPresenceIdentity(db, 'app-user', { id: '42', name: 'Name' }), /Retry key verification/);
});
