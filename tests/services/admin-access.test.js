import test from 'node:test';
import assert from 'node:assert/strict';
import { readAdminUsers, mutateAdminAccess, validateAdminAccessRequest } from '../../lib/services/admin-access.js';
import { QA_SUPABASE_URL } from '../../lib/qa-supabase-env.js';
const id = '00000000-0000-4000-8000-000000000001';
const row = { id, email: 'qa@example.test', role: 'member', is_active: true, must_change_password: false, product_ids: ['qa-one'], access_revision: 'a'.repeat(32) };
const request = { p_request_id: id, p_user_id: id, p_operation: 'products', p_revision: row.access_revision, p_values: { productIds: ['qa-one'] } };
const receipt = { requestId: id, userId: id, operation: 'products', user: row, dispatchEnabled: false };
function db(result) { return { supabaseUrl: QA_SUPABASE_URL, rpc: () => Promise.resolve(result) }; }
test('admin access request validation rejects malformed and excessive input', () => {
  assert.equal(validateAdminAccessRequest(request), request);
  for (const bad of [{ ...request, p_user_id: 'id&role=admin' }, { ...request, p_revision: '' }, { ...request, p_operation: 'delete' },
    { ...request, p_values: { productIds: ['x', 'x'] } }, { ...request, p_values: { productIds: [' x'] } },
    { ...request, p_values: { productIds: [], role: 'admin' } }, { ...request, p_operation: 'role', p_values: { role: 'owner' } }]) {
    assert.throws(() => validateAdminAccessRequest(bad), { definite: true });
  }
});
test('admin access mutation accepts only exact scoped acknowledgements', async () => {
  assert.deepEqual(await mutateAdminAccess(db({ data: receipt }), request), receipt);
  for (const bad of [null, {}, { ...receipt, userId: 'other' }, { ...receipt, operation: 'role' }, { ...receipt, dispatchEnabled: true },
    { ...receipt, user: { ...row, product_ids: [] } }, { ...receipt, user: { ...row, access_revision: '' } }, { ...receipt, user: { ...row, role: 'admin' } }]) {
    await assert.rejects(mutateAdminAccess(db({ data: bad }), request), /could not be verified/);
  }
  const role = { ...request, p_operation: 'role', p_values: { role: 'admin' } };
  await assert.rejects(mutateAdminAccess(db({ data: { ...receipt, operation: 'role' } }), role), /could not be verified/);
});
test('admin access refuses production and separates definite failures from uncertain replies', async () => {
  await assert.rejects(mutateAdminAccess({ supabaseUrl: 'https://hdniumnkprkadlrrataz.supabase.co', rpc() { assert.fail('Unexpected request'); } }, request), { definite: true });
  await assert.rejects(mutateAdminAccess(db({ error: { code: 'P0001', message: 'Stale access' } }), request), { definite: true });
  await assert.rejects(mutateAdminAccess(db({ error: { code: '08006', message: 'Disconnected' } }), request), { definite: false });
});
test('admin user reads paginate by identity and reject repeated or malformed pages', async () => {
  const many = Array.from({ length: 501 }, (_, i) => ({ ...row, id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}` }));
  const calls = [];
  const client = { supabaseUrl: QA_SUPABASE_URL, rpc: (name, input) => {
    calls.push(input); assert.equal(name, 'qa_admin_users_page');
    return { abortSignal: () => Promise.resolve({ data: many.filter((item) => !input.p_after || item.id > input.p_after).slice(0, 500) }) };
  } };
  assert.equal((await readAdminUsers(client)).length, 501);
  assert.deepEqual(calls, [{ p_after: null }, { p_after: many[499].id }]);
  client.rpc = () => ({ abortSignal: () => Promise.resolve({ data: many.slice(0, 500) }) });
  await assert.rejects(readAdminUsers(client), /could not be verified/);
});
