import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeAdminUser,
  productAssignmentLabel,
  toggleProductAssignment,
} from '../../lib/domain/admin-users.js';

test('normalizeAdminUser converts profiles_with_products rows into UI rows', () => {
  assert.deepEqual(
    normalizeAdminUser({
      id: 'user-1',
      email: 'qa@example.com',
      username: null,
      full_name: 'QA User',
      role: 'admin',
      is_active: true,
      must_change_password: true,
      product_ids: ['immuvi', '', null],
      created_at: '2026-08-31T10:00:00Z',
    }),
    {
      id: 'user-1',
      email: 'qa@example.com',
      username: '',
      fullName: 'QA User',
      role: 'admin',
      isActive: true,
      mustChangePassword: true,
      productIds: ['immuvi'],
      createdAt: '2026-08-31T10:00:00Z',
      lastLoginAt: '',
    },
  );
});

test('toggleProductAssignment removes existing ids and adds new ids sorted', () => {
  assert.deepEqual(toggleProductAssignment(['immuvi', 'astro-rekha'], 'immuvi'), ['astro-rekha']);
  assert.deepEqual(toggleProductAssignment(['immuvi'], 'kids-mental-health'), ['immuvi', 'kids-mental-health']);
});

test('productAssignmentLabel summarizes admin and member access', () => {
  assert.equal(productAssignmentLabel({ role: 'admin', productIds: [] }), 'All products');
  assert.equal(productAssignmentLabel({ role: 'member', productIds: [] }), 'No products');
  assert.equal(
    productAssignmentLabel({ role: 'member', productIds: ['immuvi'] }, { immuvi: 'Immuvi' }),
    'Immuvi',
  );
});
