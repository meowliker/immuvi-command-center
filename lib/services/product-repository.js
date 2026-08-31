import { buildProductConfigForUpsert, productRowToView } from '../domain/product-config.js';
import { supabaseRestRequest } from './supabase-rest.js';

function firstRow(rows) {
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export function productConfigSelectPath(productId) {
  return `/products?id=eq.${encodeURIComponent(productId)}&select=config&limit=1`;
}

export function productUpsertPath() {
  return '/products?on_conflict=id';
}

export function productToUpsertRow(product, existingConfig = {}) {
  if (!product || !product.id) {
    throw new Error('product.id is required');
  }

  return {
    id: product.id,
    name: product.name,
    config: buildProductConfigForUpsert(product, existingConfig),
  };
}

export async function listProducts(options = {}) {
  const rows = await supabaseRestRequest('GET', '/products?select=*&order=name.asc', undefined, options);
  return Array.isArray(rows) ? rows.map(productRowToView).filter(Boolean) : [];
}

export async function getExistingProductConfig(productId, options = {}) {
  const row = firstRow(await supabaseRestRequest('GET', productConfigSelectPath(productId), undefined, options));
  return row && row.config && typeof row.config === 'object' ? row.config : {};
}

export async function upsertProduct(product, options = {}) {
  const existingConfig = await getExistingProductConfig(product.id, options).catch(() => ({}));
  const row = productToUpsertRow(product, existingConfig);
  await supabaseRestRequest('POST', productUpsertPath(), [row], {
    ...options,
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
  return { ok: true };
}
