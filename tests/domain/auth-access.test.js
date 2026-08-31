import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canAccessProduct,
  isActiveProfile,
  isAdminProfile,
  normalizeProductIds,
  resolveAccessibleProducts,
  resolveActiveProductId,
} from '../../lib/domain/auth-access.js';

test('profile helpers require an active profile', () => {
  assert.equal(isActiveProfile({ is_active: true }), true);
  assert.equal(isActiveProfile({ is_active: false }), false);
  assert.equal(isAdminProfile({ role: 'admin', is_active: true }), true);
  assert.equal(isAdminProfile({ role: 'admin', is_active: false }), false);
});

test('normalizeProductIds accepts rows and ids', () => {
  assert.deepEqual(normalizeProductIds([{ product_id: 'immuvi' }, 'astro-rekha', { product_id: '' }]), [
    'immuvi',
    'astro-rekha',
  ]);
});

test('admins can access all products while members are filtered', () => {
  const products = [{ id: 'immuvi' }, { id: 'astro-rekha' }];
  assert.deepEqual(resolveAccessibleProducts({ role: 'admin', is_active: true }, [], products), products);
  assert.deepEqual(resolveAccessibleProducts({ role: 'member', is_active: true }, ['immuvi'], products), [{ id: 'immuvi' }]);
  assert.deepEqual(resolveAccessibleProducts({ role: 'member', is_active: false }, ['immuvi'], products), []);
});

test('canAccessProduct follows legacy admin/member behavior', () => {
  assert.equal(canAccessProduct({ role: 'admin', is_active: true }, 'immuvi', []), true);
  assert.equal(canAccessProduct({ role: 'member', is_active: true }, 'immuvi', ['immuvi']), true);
  assert.equal(canAccessProduct({ role: 'member', is_active: true }, 'immuvi', ['astro-rekha']), false);
});

test('resolveActiveProductId keeps a valid saved product or falls back', () => {
  const products = [{ id: 'immuvi' }, { id: 'astro-rekha' }];
  assert.equal(resolveActiveProductId('astro-rekha', products), 'astro-rekha');
  assert.equal(resolveActiveProductId('missing', products), 'immuvi');
  assert.equal(resolveActiveProductId('missing', []), '');
});
