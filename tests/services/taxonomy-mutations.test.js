import test from 'node:test';
import assert from 'node:assert/strict';
import { mutateTaxonomy, previewTaxonomyRename } from '../../lib/services/taxonomy-mutations.js';
import { taxonomyRequest } from '../../lib/domain/taxonomy-mutations.js';
import { QA_SUPABASE_URL } from '../../lib/qa-supabase-env.js';
const request = taxonomyRequest('qa', 'angle', 'save', [{ id: 'a', updatedAt: '2026-09-24T00:00:00Z' }], { name: 'Energy', sourceLink: '', notes: '' });
const receipt = { requestId: request.p_request_id, productId: 'qa', kind: 'angle', operation: 'save', removedIds: [], dispatchEnabled: false, remotePending: 1,
  counts: { ads: 1, inspirations: 0, actions: 0, cells: 0, links: 0 }, row: { id: 'a', product_id: 'qa', updated_at: '2026-09-24T00:01:00Z', name: 'Energy', source_link: '', notes: '' } };
const db = (result) => ({ supabaseUrl: QA_SUPABASE_URL, rpc: async (name, input) => { assert.equal(name, 'qa_taxonomy_mutate'); assert.equal(input, request); return result; } });
test('taxonomy only acknowledges an exact scoped save with valid cascade counts', async () => {
  assert.deepEqual(await mutateTaxonomy(db({ data: receipt }), request), receipt);
  for (const patch of [{ productId: 'other' }, { dispatchEnabled: true }, { remotePending: -1 }, { removedIds: ['a'] }, { row: { ...receipt.row, name: 'Wrong' } }, { counts: { ...receipt.counts, cells: null } }]) {
    await assert.rejects(() => mutateTaxonomy(db({ data: { ...receipt, ...patch } }), request), /could not be verified/);
  }
});

const preview = { productId: 'qa', kind: 'angle', source: request.p_values.sources[0], beforeName: 'Before', afterName: 'Energy',
  revision: 'a'.repeat(32), counts: { ads: 2, inspirations: 3, actions: 0 }, dispatchEnabled: false };
test('rename preview verifies source version, destination, scope and nonnegative counts', async () => {
  const client = (data) => ({ supabaseUrl: QA_SUPABASE_URL, rpc: async (name, input) => {
    assert.equal(name, 'qa_taxonomy_rename_preview'); assert.deepEqual(input, { p_product_id: 'qa', p_kind: 'angle', p_source: request.p_values.sources[0], p_name: 'Energy' }); return { data };
  } });
  assert.deepEqual(await previewTaxonomyRename(client(preview), request), preview);
  for (const patch of [{ source: { ...preview.source, version: null } }, { afterName: 'Wrong' }, { beforeName: 'Energy' }, { productId: 'foreign' },
    { kind: 'persona' }, { revision: '' }, { counts: { ...preview.counts, ads: -1 } }, { counts: { ...preview.counts, inspirations: null } }, { dispatchEnabled: true }]) {
    await assert.rejects(() => previewTaxonomyRename(client({ ...preview, ...patch }), request), /could not be verified/);
  }
});
test('rename preview fails closed on transport, server errors and a production destination', async () => {
  await assert.rejects(() => previewTaxonomyRename({ supabaseUrl: 'https://production.supabase.co', rpc() { assert.fail('production request'); } }, request), /restricted to QA/);
  await assert.rejects(() => previewTaxonomyRename({ supabaseUrl: QA_SUPABASE_URL, rpc: async () => ({ error: { message: 'Taxonomy changed' } }) }, request), /Taxonomy changed/);
  await assert.rejects(() => previewTaxonomyRename({ supabaseUrl: QA_SUPABASE_URL, rpc: async () => { throw new Error('Offline'); } }, request), /Offline/);
});
test('rename acknowledgement must contain matching durable provenance; uncertainty retains original request', async () => {
  const renamedRequest = structuredClone(request); renamedRequest.p_values.renameRevision = preview.revision;
  const rename = { ...preview, counts: receipt.counts, requestId: request.p_request_id, afterVersion: receipt.row.updated_at };
  const result = { ...receipt, rename };
  const client = (data) => ({ supabaseUrl: QA_SUPABASE_URL, rpc: async () => ({ data }) });
  assert.deepEqual(await mutateTaxonomy(client(result), renamedRequest), result);
  for (const patch of [{ revision: 'b'.repeat(32) }, { afterName: 'Wrong' }, { beforeName: null }, { counts: {} }, { afterVersion: null }, { source: {} }]) {
    await assert.rejects(() => mutateTaxonomy(client({ ...result, rename: { ...rename, ...patch } }), renamedRequest), (e) => !e.definite && /could not be verified/.test(e.message));
  }
  await assert.rejects(() => mutateTaxonomy(client(receipt), renamedRequest), /could not be verified/);
});
test('taxonomy refuses production and distinguishes definite rejection from uncertain transport', async () => {
  await assert.rejects(() => mutateTaxonomy({ supabaseUrl: 'https://production.supabase.co', rpc() { throw new Error('must not run'); } }, request), (e) => e.definite === true);
  await assert.rejects(() => mutateTaxonomy(db({ error: { code: 'P0001', message: 'Stale' } }), request), (e) => e.definite === true);
  await assert.rejects(() => mutateTaxonomy(db({ error: { code: '', message: 'Network failed' } }), request), (e) => e.definite === false);
  await assert.rejects(() => mutateTaxonomy(db({ data: null }), request), (e) => !e.definite);
});
