'use client';

import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';

import { isAdminProfile } from '../../../lib/domain/auth-access.js';
import {
  normalizeAdminUser,
  productAssignmentLabel,
  toggleProductAssignment,
} from '../../../lib/domain/admin-users.js';
import { productRowToView } from '../../../lib/domain/product-config.js';
import styles from '../qa-next.module.css';

type Profile = {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  role: 'admin' | 'member';
  is_active: boolean;
  must_change_password: boolean;
};

type Product = {
  id: string;
  name: string;
  clickupListId?: string;
};

type AdminUser = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: 'admin' | 'member';
  isActive: boolean;
  mustChangePassword: boolean;
  productIds: string[];
  createdAt: string;
  lastLoginAt: string;
};

type CreateUserForm = {
  email: string;
  username: string;
  fullName: string;
  role: 'admin' | 'member';
  tempPassword: string;
  productIds: string[];
};

type AdminState =
  | { view: 'checking' }
  | { view: 'signed-out'; error?: string }
  | { view: 'forbidden'; profile: Profile }
  | {
      view: 'admin';
      session: Session;
      profile: Profile;
      users: AdminUser[];
      products: Product[];
      drafts: Record<string, string[]>;
      healthOk: boolean;
      notice?: string;
      error?: string;
    };

type QaNextAdminClientProps = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

const emptyCreateForm: CreateUserForm = {
  email: '',
  username: '',
  fullName: '',
  role: 'member',
  tempPassword: '',
  productIds: [],
};

export default function QaNextAdminClient({ supabaseUrl, supabaseAnonKey }: QaNextAdminClientProps) {
  const supabase = useMemo(
    () => createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storageKey: 'immuvi-auth',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }),
    [supabaseAnonKey, supabaseUrl],
  );
  const [state, setState] = useState<AdminState>({ view: 'checking' });
  const [createForm, setCreateForm] = useState<CreateUserForm>(emptyCreateForm);
  const [busyAction, setBusyAction] = useState('');

  useEffect(() => {
    void loadAdminState(supabase, setState);
  }, [supabase]);

  async function reload() {
    await loadAdminState(supabase, setState);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setState({ view: 'signed-out' });
  }

  async function adminApi(op: string, body: Record<string, unknown>) {
    if (state.view !== 'admin') throw new Error('Not signed in as admin');

    const response = await fetch(`/api/admin/${op}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(json.error || `Admin API failed with HTTP ${response.status}`);
    }
    return json;
  }

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createForm.email.includes('@')) {
      setAdminError(setState, 'Valid email required.');
      return;
    }

    const actionId = 'create-user';
    setBusyAction(actionId);
    try {
      const result = await adminApi('create-user', {
        email: createForm.email.trim().toLowerCase(),
        username: createForm.username.trim(),
        full_name: createForm.fullName.trim(),
        role: createForm.role,
        temp_password: createForm.tempPassword.trim() || undefined,
        product_ids: createForm.role === 'admin' ? [] : createForm.productIds,
      });
      setCreateForm(emptyCreateForm);
      await loadAdminState(supabase, setState, {
        notice: `Created ${result.email}. Temporary password: ${result.temp_password}`,
      });
    } catch (error) {
      setAdminError(setState, errorMessage(error));
    } finally {
      setBusyAction('');
    }
  }

  async function updateProducts(user: AdminUser) {
    if (state.view !== 'admin') return;
    const actionId = `products:${user.id}`;
    setBusyAction(actionId);
    try {
      await adminApi('update-products', {
        user_id: user.id,
        product_ids: state.drafts[user.id] || [],
      });
      await loadAdminState(supabase, setState, { notice: `Updated product access for ${user.email}.` });
    } catch (error) {
      setAdminError(setState, errorMessage(error));
    } finally {
      setBusyAction('');
    }
  }

  async function setRole(user: AdminUser) {
    const nextRole = user.role === 'admin' ? 'member' : 'admin';
    if (!window.confirm(`${nextRole === 'admin' ? 'Promote' : 'Demote'} ${user.email}?`)) return;

    const actionId = `role:${user.id}`;
    setBusyAction(actionId);
    try {
      await adminApi('set-role', { user_id: user.id, role: nextRole });
      await loadAdminState(supabase, setState, { notice: `${user.email} is now ${nextRole}.` });
    } catch (error) {
      setAdminError(setState, errorMessage(error));
    } finally {
      setBusyAction('');
    }
  }

  async function resetPassword(user: AdminUser) {
    if (!window.confirm(`Reset password for ${user.email}?`)) return;

    const actionId = `reset:${user.id}`;
    setBusyAction(actionId);
    try {
      const result = await adminApi('reset-password', { user_id: user.id });
      await loadAdminState(supabase, setState, {
        notice: `Temporary password for ${user.email}: ${result.temp_password}`,
      });
    } catch (error) {
      setAdminError(setState, errorMessage(error));
    } finally {
      setBusyAction('');
    }
  }

  async function setActive(user: AdminUser, active: boolean) {
    if (!active && !window.confirm(`Deactivate ${user.email}?`)) return;

    const actionId = `active:${user.id}`;
    setBusyAction(actionId);
    try {
      await adminApi(active ? 'reactivate' : 'deactivate', { user_id: user.id });
      await loadAdminState(supabase, setState, { notice: `${user.email} ${active ? 'reactivated' : 'deactivated'}.` });
    } catch (error) {
      setAdminError(setState, errorMessage(error));
    } finally {
      setBusyAction('');
    }
  }

  function setDraftProduct(userId: string, productId: string) {
    setState((current) => {
      if (current.view !== 'admin') return current;
      return {
        ...current,
        drafts: {
          ...current.drafts,
          [userId]: toggleProductAssignment(current.drafts[userId] || [], productId),
        },
      };
    });
  }

  function setCreateProduct(productId: string) {
    setCreateForm((current) => ({
      ...current,
      productIds: toggleProductAssignment(current.productIds, productId),
    }));
  }

  if (state.view === 'checking') {
    return (
      <main className={styles.shell}>
        <section className={styles.authCard}>
          <h1>Admin</h1>
          <p>Checking session...</p>
        </section>
      </main>
    );
  }

  if (state.view === 'signed-out') {
    return (
      <main className={styles.shell}>
        <section className={styles.authCard}>
          <h1>Admin</h1>
          <p>Sign in on the QA Next page first.</p>
          {state.error ? <div className={styles.error}>{state.error}</div> : null}
          <a className={styles.primaryLink} href="/qa-next">Open QA Next</a>
        </section>
      </main>
    );
  }

  if (state.view === 'forbidden') {
    return (
      <main className={styles.shell}>
        <section className={styles.authCard}>
          <h1>Admin</h1>
          <p>{state.profile.email} is signed in, but this account is not an active admin.</p>
          <button className={styles.linkButton} type="button" onClick={signOut}>Sign out</button>
        </section>
      </main>
    );
  }

  const productNameById = Object.fromEntries(state.products.map((product) => [product.id, product.name || product.id]));

  return (
    <main className={styles.dashboard}>
      <header className={styles.topbar}>
        <div>
          <span className={styles.eyebrow}>QA Next</span>
          <h1>Admin</h1>
        </div>
        <div className={styles.userPill}>
          <span>{state.profile.username || state.profile.email}</span>
          <strong>{state.profile.role}</strong>
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <section className={styles.adminToolbar}>
        <div>
          <strong>{state.users.length}</strong>
          <span>Users</span>
        </div>
        <div>
          <strong>{state.products.length}</strong>
          <span>Products</span>
        </div>
        <div className={state.healthOk ? styles.healthOk : styles.healthBad}>
          <strong>{state.healthOk ? 'Ready' : 'Offline'}</strong>
          <span>Admin API</span>
        </div>
        <a href="/qa-next">Product switcher</a>
        <a href="/qa-next/inspiration">Inspiration Queue</a>
        <a href="/immuvi-command-center.html">Legacy dashboard</a>
        <button type="button" onClick={reload}>Refresh</button>
      </section>

      {state.notice ? <div className={styles.notice}>{state.notice}</div> : null}
      {state.error ? <div className={styles.error}>{state.error}</div> : null}

      <section className={styles.adminGrid}>
        <form className={styles.adminCreate} onSubmit={createUser}>
          <div>
            <span className={styles.eyebrow}>Create User</span>
            <h2>New teammate</h2>
          </div>
          <label>
            <span>Email</span>
            <input
              autoComplete="off"
              type="email"
              value={createForm.email}
              onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })}
              required
            />
          </label>
          <label>
            <span>Username</span>
            <input
              autoComplete="off"
              value={createForm.username}
              onChange={(event) => setCreateForm({ ...createForm, username: event.target.value })}
            />
          </label>
          <label>
            <span>Full Name</span>
            <input
              autoComplete="off"
              value={createForm.fullName}
              onChange={(event) => setCreateForm({ ...createForm, fullName: event.target.value })}
            />
          </label>
          <label>
            <span>Role</span>
            <select
              value={createForm.role}
              onChange={(event) => setCreateForm({ ...createForm, role: event.target.value as CreateUserForm['role'] })}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label>
            <span>Temporary Password</span>
            <input
              autoComplete="new-password"
              type="text"
              value={createForm.tempPassword}
              onChange={(event) => setCreateForm({ ...createForm, tempPassword: event.target.value })}
              placeholder="Leave blank to generate"
            />
          </label>

          {createForm.role === 'member' ? (
            <fieldset className={styles.productChecks}>
              <legend>Product Access</legend>
              {state.products.map((product) => (
                <label key={product.id}>
                  <input
                    checked={createForm.productIds.includes(product.id)}
                    type="checkbox"
                    onChange={() => setCreateProduct(product.id)}
                  />
                  <span>{product.name || product.id}</span>
                </label>
              ))}
            </fieldset>
          ) : null}

          <button disabled={busyAction === 'create-user'} type="submit">
            {busyAction === 'create-user' ? 'Creating...' : 'Create user'}
          </button>
        </form>

        <section className={styles.adminUsers}>
          <div className={styles.adminSectionHeader}>
            <div>
              <span className={styles.eyebrow}>Manage Access</span>
              <h2>Users</h2>
            </div>
          </div>

          <div className={styles.userRows}>
            {state.users.map((user) => (
              <article className={styles.userRow} key={user.id}>
                <div className={styles.userIdentity}>
                  <strong>{user.email}</strong>
                  <span>{user.fullName || user.username || 'No profile name'}</span>
                </div>
                <div className={styles.statusStack}>
                  <span className={user.role === 'admin' ? styles.roleAdmin : styles.roleMember}>{user.role}</span>
                  <span className={user.isActive ? styles.activeBadge : styles.inactiveBadge}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {user.mustChangePassword ? <span className={styles.pendingBadge}>Password reset</span> : null}
                </div>
                <div className={styles.assignmentSummary}>
                  {productAssignmentLabel(user, productNameById)}
                </div>
                {user.role === 'member' ? (
                  <fieldset className={styles.inlineProducts}>
                    <legend>Products</legend>
                    {state.products.map((product) => (
                      <label key={product.id}>
                        <input
                          checked={(state.drafts[user.id] || []).includes(product.id)}
                          type="checkbox"
                          onChange={() => setDraftProduct(user.id, product.id)}
                        />
                        <span>{product.name || product.id}</span>
                      </label>
                    ))}
                    <button
                      disabled={busyAction === `products:${user.id}`}
                      type="button"
                      onClick={() => updateProducts(user)}
                    >
                      {busyAction === `products:${user.id}` ? 'Saving...' : 'Save access'}
                    </button>
                  </fieldset>
                ) : null}
                <div className={styles.rowActions}>
                  <button disabled={busyAction === `role:${user.id}`} type="button" onClick={() => setRole(user)}>
                    {user.role === 'admin' ? 'Demote' : 'Promote'}
                  </button>
                  <button disabled={busyAction === `reset:${user.id}`} type="button" onClick={() => resetPassword(user)}>
                    Reset password
                  </button>
                  <button
                    disabled={busyAction === `active:${user.id}`}
                    type="button"
                    onClick={() => setActive(user, !user.isActive)}
                  >
                    {user.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

async function loadAdminState(
  supabase: SupabaseClient,
  setState: React.Dispatch<React.SetStateAction<AdminState>>,
  patch: { notice?: string } = {},
) {
  const sessionResult = await supabase.auth.getSession();
  const session = sessionResult.data.session;
  if (!session) {
    setState({ view: 'signed-out' });
    return;
  }

  const profileResult = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  if (profileResult.error || !profileResult.data) {
    setState({ view: 'signed-out', error: 'Profile not found. Contact your admin.' });
    return;
  }

  const profile = profileResult.data as Profile;
  if (!isAdminProfile(profile)) {
    setState({ view: 'forbidden', profile });
    return;
  }

  const [healthResult, productsResult, usersResult] = await Promise.all([
    fetch('/api/admin/health').then((response) => response.ok).catch(() => false),
    supabase.from('products').select('*').order('name', { ascending: true }),
    supabase.from('profiles_with_products').select('*').order('created_at', { ascending: false }),
  ]);

  const products = Array.isArray(productsResult.data)
    ? productsResult.data.map((row) => productRowToView(row) as Product).filter(Boolean)
    : [];
  const users = Array.isArray(usersResult.data)
    ? usersResult.data.map((row) => normalizeAdminUser(row) as AdminUser).filter((user) => user.id)
    : [];
  const drafts = Object.fromEntries(users.map((user) => [user.id, user.productIds]));

  setState({
    view: 'admin',
    session,
    profile,
    users,
    products,
    drafts,
    healthOk: healthResult,
    notice: patch.notice,
    error: productsResult.error || usersResult.error ? 'Some admin data could not be loaded.' : undefined,
  });
}

function setAdminError(
  setState: React.Dispatch<React.SetStateAction<AdminState>>,
  message: string,
) {
  setState((current) => current.view === 'admin' ? { ...current, error: message, notice: undefined } : current);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Action failed.');
}
