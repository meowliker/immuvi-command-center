import test from 'node:test';
import assert from 'node:assert/strict';
import { mutateProduct, previewProductDeletion } from '../../lib/services/product-administration.js';
import { productAdminRequest } from '../../lib/domain/product-administration.js';
import { QA_SUPABASE_URL } from '../../lib/qa-supabase-env.js';
test('product writes accept only exact scoped receipts and refuse production before RPC', async () => {
  const request = productAdminRequest('create', null, { name: 'Test', color: '#119944' });
  const receipt = { requestId: request.p_request_id, operation: 'create', productId: request.p_product_id, dispatchEnabled: false,
    product: { id: request.p_product_id, name: 'Test', updated_at: new Date().toISOString(), config: { color: '#119944' } } };
  const db = { supabaseUrl: QA_SUPABASE_URL, rpc: async () => ({ data: receipt }) };
  assert.equal(await mutateProduct(db, request), receipt);
  await assert.rejects(mutateProduct({ ...db, supabaseUrl: 'https://production.example.test' }, request), /restricted/);
  await assert.rejects(mutateProduct({ ...db, rpc: async () => ({ data: { ...receipt, productId: 'Other' } }) }, request), /verified/);
  await assert.rejects(mutateProduct({ ...db, rpc: async () => ({ error: { code: 'P0001', message: 'Stale' } }) }, request), (error) => error.definite === true);
  await assert.rejects(mutateProduct({ ...db, rpc: async () => ({ error: { message: 'Network' } }) }, request), (error) => error.definite === false);
});
test('deletion previews reject malformed counts, wrong scope and missing revision', async () => {
  const data = { productId: 'P', revision: 'a'.repeat(32), counts: { ads: 2 }, blocked: false };
  const db = { supabaseUrl: QA_SUPABASE_URL, rpc: async () => ({ data }) };
  assert.equal(await previewProductDeletion(db, 'P'), data);
  await assert.rejects(previewProductDeletion(db, 'Other'), /verified/);
  data.counts.ads = -1;
  await assert.rejects(previewProductDeletion(db, 'P'), /verified/);
});
