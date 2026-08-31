export function isAdminProfile(profile) {
  return Boolean(profile && profile.role === 'admin' && profile.is_active === true);
}

export function isActiveProfile(profile) {
  return Boolean(profile && profile.is_active === true);
}

export function normalizeProductIds(rows) {
  return Array.isArray(rows)
    ? rows
        .map((row) => typeof row === 'string' ? row : row && row.product_id)
        .filter((id) => typeof id === 'string' && id.trim())
    : [];
}

export function canAccessProduct(profile, productId, productIds) {
  if (!isActiveProfile(profile)) return false;
  if (isAdminProfile(profile)) return true;
  return normalizeProductIds(productIds).includes(productId);
}

export function resolveAccessibleProducts(profile, productIds, products) {
  const list = Array.isArray(products) ? products : [];
  if (!isActiveProfile(profile)) return [];
  if (isAdminProfile(profile)) return list;

  const allowed = new Set(normalizeProductIds(productIds));
  return list.filter((product) => product && allowed.has(product.id));
}

export function resolveActiveProductId(savedProductId, products) {
  const list = Array.isArray(products) ? products : [];
  if (savedProductId && list.some((product) => product && product.id === savedProductId)) {
    return savedProductId;
  }
  return list.length && list[0] ? list[0].id : '';
}
