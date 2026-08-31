export function normalizeAdminUser(row) {
  const productIds = Array.isArray(row && row.product_ids)
    ? row.product_ids.filter((id) => typeof id === 'string' && id.trim())
    : [];

  return {
    id: row && row.id ? String(row.id) : '',
    email: row && row.email ? String(row.email) : '',
    username: row && row.username ? String(row.username) : '',
    fullName: row && row.full_name ? String(row.full_name) : '',
    role: row && row.role === 'admin' ? 'admin' : 'member',
    isActive: Boolean(row && row.is_active),
    mustChangePassword: Boolean(row && row.must_change_password),
    productIds,
    createdAt: row && row.created_at ? String(row.created_at) : '',
    lastLoginAt: row && row.last_login_at ? String(row.last_login_at) : '',
  };
}

export function toggleProductAssignment(productIds, productId) {
  const id = String(productId || '').trim();
  const existing = Array.isArray(productIds)
    ? productIds.filter((item) => typeof item === 'string' && item.trim())
    : [];
  if (!id) return existing;

  if (existing.includes(id)) {
    return existing.filter((item) => item !== id);
  }

  return [...existing, id].sort();
}

export function productAssignmentLabel(user, productNameById = {}) {
  if (!user) return 'No products';
  if (user.role === 'admin') return 'All products';
  if (!Array.isArray(user.productIds) || !user.productIds.length) return 'No products';
  return user.productIds.map((id) => productNameById[id] || id).join(', ');
}
