import test from 'node:test';
import assert from 'node:assert/strict';
import { pauseWorker, readWorkers, validateWorkerPause } from '../../lib/services/worker-controls.js';
import { QA_SUPABASE_URL } from '../../lib/qa-supabase-env.js';
const id = '00000000-0000-4000-8000-000000000001';
const request = { p_request_id: id, p_worker_id: 'qa-worker', p_revision: id };
const receipt = { requestId: id, workerId: 'qa-worker', revision: id, enabled: false, dispatchEnabled: false, operation: 'pause', acknowledgedAt: new Date().toISOString() };
const client = (result) => ({ supabaseUrl: QA_SUPABASE_URL, rpc: () => Promise.resolve(result) });
test('worker controls accept only a bounded pause identity, never enable or extra fields', () => {
  assert.equal(validateWorkerPause(request), request);
  for (const bad of [null, {}, { ...request, enabled: true }, { ...request, p_revision: '' }, { ...request, p_worker_id: '' }, { ...request, p_worker_id: 'x'.repeat(201) }]) assert.throws(() => validateWorkerPause(bad), { definite: true });
});
test('worker pause verifies exact acknowledgement and keeps unknown outcomes recoverable', async () => {
  assert.deepEqual(await pauseWorker(client({ data: receipt }), request), receipt);
  for (const bad of [null, {}, { ...receipt, workerId: 'other' }, { ...receipt, requestId: 'other' }, { ...receipt, enabled: true }, { ...receipt, dispatchEnabled: true }, { ...receipt, revision: 'invalid' }, { ...receipt, operation: 'resume' }, { ...receipt, acknowledgedAt: '' }]) await assert.rejects(pauseWorker(client({ data: bad }), request), /could not be verified/);
  await assert.rejects(pauseWorker(client({ error: { code: 'P0001', message: 'Changed' } }), request), { definite: true });
  await assert.rejects(pauseWorker(client({ error: { code: '08006', message: 'Disconnected' } }), request), { definite: false });
});
test('worker reads and pauses refuse production before making any request', async () => {
  const db = { supabaseUrl: 'https://hdniumnkprkadlrrataz.supabase.co', rpc() { assert.fail('Unexpected call'); } };
  await assert.rejects(pauseWorker(db, request), { definite: true });
  await assert.rejects(readWorkers(db), { definite: true });
});
test('worker pool completes pagination and rejects repeated, duplicate, malformed and failed pages', async () => {
  const rows = Array.from({ length: 401 }, (_, i) => ({ worker_id: `qa-${String(i).padStart(4, '0')}`, control_revision: id, enabled: false }));
  const calls = [];
  const db = { supabaseUrl: QA_SUPABASE_URL, rpc(name, input) { calls.push(input); assert.equal(name, 'qa_workers_page'); return { abortSignal: () => Promise.resolve({ data: rows.filter((r) => !input.p_after || r.worker_id > input.p_after).slice(0, 200) }) }; } };
  assert.equal((await readWorkers(db)).length, 401); assert.equal(calls.length, 3);
  for (const result of [{ data: rows.slice(0, 200) }, { data: [rows[0], rows[0]] }, { data: [{ ...rows[0], control_revision: 'bad' }] }, { error: { message: 'Read failed' } }]) {
    db.rpc = () => ({ abortSignal: () => Promise.resolve(result) });
    await assert.rejects(readWorkers(db));
  }
});
