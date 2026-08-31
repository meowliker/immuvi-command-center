'use client';

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';

import {
  productClickUpListId,
  productClickUpListName,
  productRowToView,
} from '../../lib/domain/product-config.js';
import {
  normalizeProductIds,
  resolveAccessibleProducts,
  resolveActiveProductId,
} from '../../lib/domain/auth-access.js';
import styles from './qa-next.module.css';

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
  config?: Record<string, unknown>;
  clickupListId?: string;
  clickupListName?: string;
};

type AppState =
  | { view: 'checking'; message?: string }
  | { view: 'login'; error?: string }
  | { view: 'password'; user: User; profile: Profile; error?: string }
  | {
      view: 'dashboard';
      user: User;
      profile: Profile;
      products: Product[];
      activeProductId: string;
      error?: string;
    };

type QaNextClientProps = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

const ACTIVE_PRODUCT_KEY = 'immuvi_active_product';

export default function QaNextClient({ supabaseUrl, supabaseAnonKey }: QaNextClientProps) {
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
  const [state, setState] = useState<AppState>({ view: 'checking' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void hydrateSession(supabase, setState);
  }, [supabase]);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setState({ view: 'login', error: 'Email and password required.' });
      return;
    }

    setBusy(true);
    const result = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);

    if (result.error || !result.data.session) {
      setState({ view: 'login', error: result.error?.message || 'Sign-in failed.' });
      return;
    }

    await loadAuthedState(supabase, result.data.session.user, setState);
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 8) {
      setState((current) => current.view === 'password'
        ? { ...current, error: 'Password must be at least 8 characters.' }
        : current);
      return;
    }
    if (newPassword !== confirmPassword) {
      setState((current) => current.view === 'password'
        ? { ...current, error: 'Passwords do not match.' }
        : current);
      return;
    }

    setBusy(true);
    const update = await supabase.auth.updateUser({ password: newPassword });
    if (!update.error && state.view === 'password') {
      await supabase.from('profiles').update({ must_change_password: false }).eq('id', state.profile.id);
      await loadAuthedState(supabase, state.user, setState);
    }
    setBusy(false);

    if (update.error) {
      setState((current) => current.view === 'password'
        ? { ...current, error: update.error?.message || 'Password update failed.' }
        : current);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.localStorage.removeItem(ACTIVE_PRODUCT_KEY);
    setState({ view: 'login' });
  }

  function switchProduct(productId: string) {
    window.localStorage.setItem(ACTIVE_PRODUCT_KEY, productId);
    setState((current) => current.view === 'dashboard' ? { ...current, activeProductId: productId } : current);
  }

  if (state.view === 'checking') {
    return (
      <main className={styles.shell}>
        <section className={styles.authCard}>
          <h1>Immuvi Command Center</h1>
          <p>Checking session...</p>
        </section>
      </main>
    );
  }

  if (state.view === 'login') {
    return (
      <main className={styles.shell}>
        <form className={styles.authCard} onSubmit={signIn}>
          <h1>Immuvi Command Center</h1>
          <p>Sign in to continue</p>
          <label>
            <span>Email</span>
            <input
              autoComplete="username"
              autoFocus
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {state.error ? <div className={styles.error}>{state.error}</div> : null}
          <button disabled={busy} type="submit">{busy ? 'Signing in...' : 'Sign in'}</button>
          <small>Need access? Contact your admin.</small>
        </form>
      </main>
    );
  }

  if (state.view === 'password') {
    return (
      <main className={styles.shell}>
        <form className={styles.authCard} onSubmit={changePassword}>
          <h1>Set a new password</h1>
          <p>Choose a new password to continue.</p>
          <label>
            <span>New password</span>
            <input
              autoComplete="new-password"
              minLength={8}
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Confirm password</span>
            <input
              autoComplete="new-password"
              minLength={8}
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </label>
          {state.error ? <div className={styles.error}>{state.error}</div> : null}
          <button disabled={busy} type="submit">{busy ? 'Updating...' : 'Set new password'}</button>
          <button className={styles.linkButton} type="button" onClick={signOut}>Sign out</button>
        </form>
      </main>
    );
  }

  const activeProduct = state.products.find((product) => product.id === state.activeProductId) || state.products[0];
  const userLabel = state.profile.username || state.profile.full_name || state.profile.email;

  return (
    <main className={styles.dashboard}>
      <header className={styles.topbar}>
        <div>
          <span className={styles.eyebrow}>QA Next</span>
          <h1>Immuvi Command Center</h1>
        </div>
        <div className={styles.userPill}>
          <span>{userLabel}</span>
          <strong>{state.profile.role}</strong>
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <section className={styles.productBar}>
        <label>
          <span>Product</span>
          <select
            value={activeProduct?.id || ''}
            onChange={(event) => switchProduct(event.target.value)}
            disabled={!state.products.length}
          >
            {state.products.map((product) => (
              <option key={product.id} value={product.id}>{product.name || product.id}</option>
            ))}
          </select>
        </label>
        <div className={styles.navActions}>
          {state.profile.role === 'admin' ? <a href="/qa-next/admin">Admin</a> : null}
          <a href="/immuvi-command-center.html">Open legacy dashboard</a>
        </div>
      </section>

      {state.error ? <div className={styles.error}>{state.error}</div> : null}

      <section className={styles.grid}>
        <article className={styles.panel}>
          <span className={styles.eyebrow}>Active Product</span>
          <h2>{activeProduct?.name || 'No products assigned'}</h2>
          <dl>
            <div>
              <dt>Product ID</dt>
              <dd>{activeProduct?.id || '-'}</dd>
            </div>
            <div>
              <dt>ClickUp List</dt>
              <dd>{activeProduct ? productClickUpListName(activeProduct) || productClickUpListId(activeProduct) || '-' : '-'}</dd>
            </div>
            <div>
              <dt>ClickUp List ID</dt>
              <dd>{activeProduct ? productClickUpListId(activeProduct) || '-' : '-'}</dd>
            </div>
          </dl>
        </article>

        <article className={styles.panel}>
          <span className={styles.eyebrow}>Access</span>
          <h2>{state.profile.role === 'admin' ? 'All products' : `${state.products.length} assigned`}</h2>
          <div className={styles.productList}>
            {state.products.map((product) => (
              <button
                className={product.id === activeProduct?.id ? styles.activeProduct : ''}
                key={product.id}
                type="button"
                onClick={() => switchProduct(product.id)}
              >
                <span>{product.name || product.id}</span>
                <small>{productClickUpListId(product) || 'No ClickUp list'}</small>
              </button>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}

async function hydrateSession(
  supabase: SupabaseClient,
  setState: React.Dispatch<React.SetStateAction<AppState>>,
) {
  const session = await supabase.auth.getSession();
  const user = session.data.session?.user;
  if (!user) {
    setState({ view: 'login' });
    return;
  }

  await loadAuthedState(supabase, user, setState);
}

async function loadAuthedState(
  supabase: SupabaseClient,
  user: User,
  setState: React.Dispatch<React.SetStateAction<AppState>>,
) {
  const [profileResult, userProductsResult, productsResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('user_products').select('product_id').eq('user_id', user.id),
    supabase.from('products').select('*').order('name', { ascending: true }),
  ]);

  if (profileResult.error || !profileResult.data) {
    await supabase.auth.signOut();
    setState({ view: 'login', error: 'Profile not found. Contact your admin.' });
    return;
  }

  const profile = profileResult.data as Profile;
  if (!profile.is_active) {
    await supabase.auth.signOut();
    setState({ view: 'login', error: 'Your account has been deactivated.' });
    return;
  }

  void supabase.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', profile.id);

  if (profile.must_change_password) {
    setState({ view: 'password', user, profile });
    return;
  }

  const allProducts = Array.isArray(productsResult.data)
    ? productsResult.data.map((row) => productRowToView(row) as Product).filter(Boolean)
    : [];
  const assignedProductIds = profile.role === 'admin' ? null : normalizeProductIds(userProductsResult.data || []);
  const products = resolveAccessibleProducts(profile, assignedProductIds || [], allProducts) as Product[];
  const savedProductId = typeof window !== 'undefined' ? window.localStorage.getItem(ACTIVE_PRODUCT_KEY) || '' : '';
  const activeProductId = resolveActiveProductId(savedProductId, products);
  if (activeProductId) window.localStorage.setItem(ACTIVE_PRODUCT_KEY, activeProductId);

  setState({
    view: 'dashboard',
    user,
    profile,
    products,
    activeProductId,
    error: productsResult.error ? 'Products could not be fully loaded.' : undefined,
  });
}
