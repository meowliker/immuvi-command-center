'use client';

import { normalizeAdminUser, toggleProductAssignment } from '../../../lib/domain/admin-users.js';
import { productRowToView } from '../../../lib/domain/product-config.js';
import type { AdminUser, CreateUserForm, Product } from '../types';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { sameData } from '../../../lib/domain/live-data.js';
import { useState } from 'react';
import { useLiveQuery, type RefreshOptions } from './use-live-query';
import { useReconciledState } from './use-reconciled-state';
import { useAdminAccess } from './use-admin-access';
import { readAdminUsers } from '../../../lib/services/admin-access.js';
import { useAccountOperation, type AccountRequest } from './use-account-operation';
import { useAccountCreation } from './use-account-creation';

const emptyCreateForm: CreateUserForm = {
  email: '',
  username: '',
  fullName: '',
  role: 'member',
  tempPassword: '',
  productIds: [],
};

export function useAdmin({ supabase, session }: { supabase: SupabaseClient; session: Session }) {
  const [users, setUsers] = useReconciledState<AdminUser[]>([]);
  const [products, setProducts] = useReconciledState<Product[]>([]);
  const [accessDrafts, setDrafts] = useState<Record<string, { productIds: string[]; revision: string }>>({});
  const [createForm, setCreateForm] = useState<CreateUserForm>(emptyCreateForm);
  const [healthOk, setHealthOk] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const creation = useAccountCreation(supabase, session.user.id, (result) => {
    if (result.user) setUsers((current) => [...current.filter((row) => row.id !== result.userId), normalizeAdminUser(result.user) as AdminUser].sort((a, b) => a.email.localeCompare(b.email)));
    setCreateForm(emptyCreateForm); setError('');
    setNotice(result.credentialsAvailable ? `Created ${result.email}. Temporary password: ${result.temp_password}`
      : `Creation confirmed for ${result.email}. The original temporary password is no longer available.`);
  });
  const account = useAccountOperation(supabase, session.user.id, (result) => {
    setUsers((current) => result.operation === 'delete-user' ? current.filter((user) => user.id !== result.userId)
      : current.map((user) => user.id === result.userId ? normalizeAdminUser(result.user) as AdminUser : user));
    setError('');
    setNotice(result.operation === 'reset-password'
      ? result.credentialsAvailable ? `Temporary password for ${result.user.email}: ${result.temp_password}` : 'Password reset confirmed. The temporary password has since changed and is no longer available.'
      : `${result.operation === 'delete-user' ? 'Account deleted' : result.operation === 'deactivate' ? 'Account deactivated' : 'Account reactivated'}.`);
  });
  const access = useAdminAccess(supabase, session.user.id, (row, request) => {
    const user = normalizeAdminUser(row) as AdminUser;
    setUsers((current) => current.map((item) => item.id === user.id ? user : item));
    setDrafts((current) => {
      const next = { ...current };
      if (request.p_operation === 'products' && sameData(current[user.id]?.productIds, request.p_values.productIds)) delete next[user.id];
      return next;
    });
    setError(''); setNotice(`Updated ${request.p_operation === 'role' ? 'role' : 'product access'} for ${user.email}.`);
  });

  async function adminApi(op: string, body: Record<string, unknown>) {
    const { data, error } = await supabase.auth.getSession();
    if (error || data.session?.user.id !== session.user.id) throw new Error('QA session expired.');
    const response = await fetch(`/api/admin/${op}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || `Admin API failed with HTTP ${response.status}`);
    return json;
  }

  const { refresh, busy, error: syncError } = useLiveQuery({
    supabase,
    productId: '',
    tables: ['profiles', 'products', 'user_products'],
    enabled: true,
    load,
    onMutationError: setError,
  });

  async function reload(options: { notice?: string } = {}) {
    setError('');
    if (options.notice) setNotice(options.notice);
    await refresh();
  }

  async function load(signal: AbortSignal, options: RefreshOptions) {
    const [healthResult, usersResult, productsResult] = await Promise.all([
      adminApi('health', {}).then(() => true).catch(() => false),
      readAdminUsers(supabase, signal),
      readProducts(signal),
    ]);
    return () => {
      const nextUsers = (usersResult.map(normalizeAdminUser) as AdminUser[]).sort((a, b) => a.email.localeCompare(b.email));
      setUsers(nextUsers);
      setProducts(productsResult);
      setLoaded(true);
      setHealthOk(Boolean(healthResult));
    };
  }

  async function readProducts(signal: AbortSignal) {
    const rows: Product[] = [];
    for (let from = 0; ; from += 500) {
      const result = await supabase.from('products').select('*').order('id').range(from, from + 499).abortSignal(signal);
      if (result.error || !Array.isArray(result.data)) throw new Error('Products could not be loaded.');
      rows.push(...result.data.map((row) => productRowToView(row) as Product).filter(Boolean));
      if (result.data.length < 500) return rows.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (writesBlocked) return;
    setNotice(''); setError('');
    const email = createForm.email.trim().toLowerCase();
    await creation.submit({ requestId: crypto.randomUUID(), email, username: createForm.username.trim() || email.split('@')[0],
      fullName: createForm.fullName.trim(), role: createForm.role, productIds: createForm.role === 'admin' ? [] : [...createForm.productIds].sort(),
      passwordMode: createForm.tempPassword ? 'custom' : 'generated', ...(createForm.tempPassword ? { tempPassword: createForm.tempPassword } : {}) });
  }

  async function updateProducts(user: AdminUser) {
    const draft = accessDrafts[user.id];
    if (!draft || writesBlocked) return;
    await access.submit({ p_request_id: crypto.randomUUID(), p_user_id: user.id, p_operation: 'products', p_revision: draft.revision, p_values: { productIds: draft.productIds } });
  }

  async function setRole(user: AdminUser) {
    if (writesBlocked || user.id === session.user.id) return;
    const nextRole = user.role === 'admin' ? 'member' : 'admin';
    if (!window.confirm(`${nextRole === 'admin' ? 'Promote' : 'Demote'} ${user.email}?`)) return;
    await access.submit({ p_request_id: crypto.randomUUID(), p_user_id: user.id, p_operation: 'role', p_revision: user.accessRevision, p_values: { role: nextRole } });
  }

  async function resetPassword(user: AdminUser) {
    if (writesBlocked || user.id === session.user.id) return;
    if (!window.confirm(`Reset password for ${user.email}?`)) return;
    return accountChange(user, 'reset-password');
  }

  async function setActive(user: AdminUser, active: boolean) {
    if (writesBlocked || user.id === session.user.id) return;
    if (!window.confirm(`${active ? 'Reactivate' : 'Deactivate'} ${user.email}?`)) return;
    return accountChange(user, active ? 'reactivate' : 'deactivate');
  }

  async function accountChange(user: AdminUser, operation: AccountRequest['operation'], confirmEmail = '') {
    if (writesBlocked || user.id === session.user.id) return false;
    setNotice(''); setError('');
    return account.submit({ requestId: crypto.randomUUID(), userId: user.id, operation, revision: user.accessRevision, confirmEmail });
  }

  function setDraftProduct(userId: string, productId: string) {
    const user = users.find((row) => row.id === userId);
    if (!user || writesBlocked) return;
    setDrafts((current) => ({ ...current, [userId]: { revision: current[userId]?.revision || user.accessRevision,
      productIds: toggleProductAssignment(current[userId]?.productIds || user.productIds, productId) } }));
  }

  function reviewAccess(user: AdminUser) {
    if (writesBlocked || !window.confirm(`Current saved access for ${user.email}: ${user.productIds.map((id) => productNameById[id] || id).join(', ') || 'No products'}. Keep your selected products and apply them to this latest version?`)) return;
    setDrafts((current) => current[user.id] ? { ...current, [user.id]: { ...current[user.id], revision: user.accessRevision } } : current);
  }

  function setCreateProduct(productId: string) {
    setCreateForm((current) => ({ ...current, productIds: toggleProductAssignment(current.productIds, productId) }));
  }

  const productNameById = Object.fromEntries(products.map((product) => [product.id, product.name || product.id]));
  const writesBlocked = !loaded || !!syncError || !access.ready || !!access.pending || access.busy
    || !account.ready || !!account.pending || account.busy || !creation.ready || !!creation.pending || creation.busy;
  const drafts = Object.fromEntries(users.map((user) => [user.id, accessDrafts[user.id]?.productIds || user.productIds]));

  return {
    users,
    products,
    healthOk,
    reload,
    notice,
    error: creation.error || account.error || access.error || error || syncError,
    creationPending: creation.pending,
    creationBusy: creation.busy,
    recoverCreation: () => creation.pending && creation.submit(creation.pending),
    accountPending: account.pending,
    accountBusy: account.busy,
    recoverAccount: () => account.pending && account.submit(account.pending),
    deleteUser: (user: AdminUser, email: string) => accountChange(user, 'delete-user', email),
    accessPending: access.pending,
    retryAccess: () => access.pending && access.submit(access.pending),
    accessBusy: access.busy,
    writesBlocked,
    staleAccess: (user: AdminUser) => !!accessDrafts[user.id] && accessDrafts[user.id].revision !== user.accessRevision,
    dirtyAccess: (user: AdminUser) => !!accessDrafts[user.id] && !sameData(accessDrafts[user.id].productIds, user.productIds),
    reviewAccess,
    createUser,
    createForm,
    setCreateForm,
    setCreateProduct,
    busyAction: creation.busy ? 'create-user' : busy ? 'reload' : '',
    productNameById,
    drafts,
    setDraftProduct,
    updateProducts,
    resetPassword,
    setRole,
    setActive,
  };
}
