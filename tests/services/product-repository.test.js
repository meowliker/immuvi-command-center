import test from 'node:test';
import assert from 'node:assert/strict';

import { buildProductConfigForUpsert } from '../../lib/domain/product-config.js';
import {
  getExistingProductConfig,
  listProducts,
  productConfigSelectPath,
  productToUpsertRow,
  productUpsertPath,
  upsertProduct,
} from '../../lib/services/product-repository.js';

const serviceEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
};

test('buildProductConfigForUpsert keeps existing ClickUp config when stale patch is blank', () => {
  const config = buildProductConfigForUpsert(
    { clickupListId: '', clickupListName: '', lastSyncedCount: 0 },
    {
      clickup_list_id: '901616718146',
      clickup_list_name: 'Immuvi QA Test List',
      last_synced_count: 50,
    },
  );

  assert.equal(config.clickup_list_id, '901616718146');
  assert.equal(config.clickup_list_name, 'Immuvi QA Test List');
  assert.equal(config.last_synced_count, 50);
});

test('buildProductConfigForUpsert supports explicit clear sentinel', () => {
  const config = buildProductConfigForUpsert(
    { clickupListId: '__clear__', clickupListName: '__clear__', lastSyncedCount: '__clear__' },
    {
      clickup_list_id: '901616718146',
      clickup_list_name: 'Immuvi QA Test List',
      last_synced_count: 50,
    },
  );

  assert.equal(config.clickup_list_id, '');
  assert.equal(config.clickup_list_name, '');
  assert.equal(config.last_synced_count, 0);
});

test('product paths encode identifiers and preserve upsert contract', () => {
  assert.equal(productConfigSelectPath('immuvi/test'), '/products?id=eq.immuvi%2Ftest&select=config&limit=1');
  assert.equal(productUpsertPath(), '/products?on_conflict=id');
});

test('productToUpsertRow builds the legacy-compatible row shape', () => {
  assert.deepEqual(
    productToUpsertRow(
      { id: 'immuvi', name: 'Immuvi', clickupListId: '901616718146', color: '#fff' },
      { doc_id: 'doc-1' },
    ),
    {
      id: 'immuvi',
      name: 'Immuvi',
      config: {
        doc_id: 'doc-1',
        clickup_list_id: '901616718146',
        color: '#fff',
      },
    },
  );
});

test('listProducts maps Supabase rows through the view converter', async () => {
  const fetchImpl = async () => new Response(JSON.stringify([
    { id: 'immuvi', name: 'Immuvi', config: { clickup_list_id: '901616718146' } },
  ]));

  const rows = await listProducts({ env: serviceEnv, fetchImpl });
  assert.equal(rows[0].clickupListId, '901616718146');
});

test('getExistingProductConfig returns empty config when the product is missing', async () => {
  const fetchImpl = async () => new Response(JSON.stringify([]));

  assert.deepEqual(await getExistingProductConfig('missing', { env: serviceEnv, fetchImpl }), {});
});

test('upsertProduct fetches existing config and writes a preserving upsert', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (init.method === 'GET') {
      return new Response(JSON.stringify([{ config: { clickup_list_id: '901616718146' } }]));
    }
    return new Response(null, { status: 204 });
  };

  const result = await upsertProduct(
    { id: 'immuvi', name: 'Immuvi', clickupListId: '', color: '#123456' },
    { env: serviceEnv, fetchImpl },
  );

  assert.deepEqual(result, { ok: true });
  assert.equal(calls[1].url, 'https://example.supabase.co/rest/v1/products?on_conflict=id');
  assert.equal(calls[1].init.headers.Prefer, 'resolution=merge-duplicates,return=minimal');
  assert.equal(
    calls[1].init.body,
    '[{"id":"immuvi","name":"Immuvi","config":{"clickup_list_id":"901616718146","color":"#123456"}}]',
  );
});
