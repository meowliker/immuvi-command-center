'use client';

import { ACTIVE_PRODUCT_KEY, ACTIVE_TAB_KEY, validTabForProfile } from '../navigation';
import { fetchAuthedState } from '../services/auth';
import { getSupabaseBrowserClient } from '../services/supabase-client';
import { storeQaClickUpToken } from '../services/qa-clickup';
import type { ActiveTab, AppState, QaNextClientProps } from '../types';
import type { Session } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { resolveActiveProductId } from '../../../lib/domain/auth-access.js';
import { sameData } from '../../../lib/domain/live-data.js';
import { useLiveQuery } from './use-live-query';

export function useCommandCenter({ supabaseUrl, supabaseAnonKey }: QaNextClientProps) {
  const supabase = getSupabaseBrowserClient(supabaseUrl, supabaseAnonKey);
  const [state, setState] = useState<AppState>({ view: 'checking' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const authRevision = useRef(0);

  const { refresh: reloadAccess, error: accessError } = useLiveQuery({
    supabase, productId: '', scopeKey: session?.user.id || '',
    tables: ['profiles', 'user_products', 'products'], enabled: Boolean(session),
    async load(signal) {
      const revision = authRevision.current;
      const next = await fetchAuthedState(supabase, session!, signal);
      return () => {
        if (revision !== authRevision.current) return;
        if (next.view === 'login') {
          setSession(null);
          void supabase.auth.signOut();
        }
        setState((current) => {
          if (current.view === 'dashboard' && next.view === 'dashboard' && current.user.id === next.user.id) {
            next.activeProductId = resolveActiveProductId(current.activeProductId, next.products);
            next.activeTab = validTabForProfile(current.activeTab, next.profile) ? current.activeTab : 'overview';
          }
          return sameData(current, next) ? current : next;
        });
      };
    },
  });

  useEffect(() => {
    let active = true;
    let observed = false;
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      observed = true;
      authRevision.current += 1;
      setSession(nextSession);
      if (!nextSession) {
        setState((current) => current.view === 'login' ? current : { view: 'login' });
      } else {
        setState((current) => current.view === 'dashboard' || current.view === 'password'
          ? current.user.id === nextSession.user.id ? { ...current, session: nextSession } : { view: 'checking' }
          : { view: 'checking' });
        // Keep the SDK callback synchronous; access reads run outside its auth lock.
        queueMicrotask(() => { if (active) void reloadAccess(); });
      }
    });
    void supabase.auth.getSession().then(({ data: initial, error }) => {
      if (!active || observed) return;
      if (error) setState({ view: 'login', error: error.message });
      else if (initial.session) setSession(initial.session);
      else setState({ view: 'login' });
    });
    return () => { active = false; authRevision.current += 1; data.subscription.unsubscribe(); };
  }, [supabase, reloadAccess]);

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

    setSession(result.data.session);
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
      // Auth's password-hash update clears the flag in the QA database transaction.
      const confirmed = await supabase.from('profiles').select('must_change_password').eq('id', state.profile.id).single();
      if (confirmed.error || confirmed.data?.must_change_password !== false) setState((current) => current.view === 'password'
        ? { ...current, error: 'Password confirmation is incomplete. Refresh your session before trying again.' } : current);
      else { setNewPassword(''); setConfirmPassword(''); await reloadAccess(); }
    }
    setBusy(false);

    if (update.error) {
      setState((current) => current.view === 'password'
        ? { ...current, error: update.error?.message || 'Password update failed.' }
        : current);
    }
  }

  async function signOut() {
    if (session?.user.id) {
      try { storeQaClickUpToken(session.user.id, ''); } catch { /* Storage may be unavailable in private browsing. */ }
    }
    authRevision.current += 1;
    setSession(null);
    setState({ view: 'login' });
    await supabase.auth.signOut();
    window.localStorage.removeItem(ACTIVE_PRODUCT_KEY);
    setState({ view: 'login' });
  }

  function switchProduct(productId: string) {
    if (state.view !== 'dashboard' || !state.products.some((product) => product.id === productId)) return;
    window.localStorage.setItem(ACTIVE_PRODUCT_KEY, productId);
    setState((current) => current.view === 'dashboard' ? { ...current, activeProductId: productId } : current);
  }

  function setActiveTab(activeTab: ActiveTab) {
    window.localStorage.setItem(ACTIVE_TAB_KEY, activeTab);
    setState((current) => current.view === 'dashboard' ? { ...current, activeTab } : current);
  }

  return {
    state: accessError && state.view === 'checking' ? { ...state, message: accessError }
      : accessError && state.view === 'dashboard' ? { ...state, error: accessError } : state,
    reloadAccess,
    signIn,
    email,
    setEmail,
    password,
    setPassword,
    busy,
    changePassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    signOut,
    switchProduct,
    setActiveTab,
    supabase,
  };
}
