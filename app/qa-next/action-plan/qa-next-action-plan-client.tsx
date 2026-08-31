'use client';

import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';

import {
  actionPlanBucket,
  isActionOverdue,
  normalizeActionAd,
  normalizeManualActionRow,
  resolveActionDisplay,
  summarizeActionPlan,
  timestampMs,
} from '../../../lib/domain/action-plan.js';
import {
  normalizeProductIds,
  resolveAccessibleProducts,
  resolveActiveProductId,
} from '../../../lib/domain/auth-access.js';
import {
  productClickUpListId,
  productRowToView,
} from '../../../lib/domain/product-config.js';
import styles from '../qa-next.module.css';

type Profile = {
  id: string;
  email: string;
  username: string | null;
  role: 'admin' | 'member';
  is_active: boolean;
  must_change_password: boolean;
};

type Product = {
  id: string;
  name: string;
  clickupListId?: string;
};

type ActionDisplay = NonNullable<ReturnType<typeof resolveActionDisplay>>;
type ActionFilter = 'all' | 'backlog' | 'production' | 'testing' | 'winners' | 'losers' | 'overdue';

type ActivityEvent = {
  id: string;
  event_type: string;
  action_id: string | null;
  clickup_task_id: string | null;
  field_name: string | null;
  new_value: string | null;
  actor: string | null;
  source: string;
  created_at: string;
};

type ActionPlanState =
  | { view: 'checking' }
  | { view: 'signed-out'; error?: string }
  | { view: 'password-required'; email: string }
  | {
      view: 'action-plan';
      session: Session;
      profile: Profile;
      products: Product[];
      activeProductId: string;
      actions: ActionDisplay[];
      events: ActivityEvent[];
      filter: ActionFilter;
      loadedAt: string;
      error?: string;
    };

type QaNextActionPlanClientProps = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

const ACTIVE_PRODUCT_KEY = 'immuvi_active_product';

export default function QaNextActionPlanClient({ supabaseUrl, supabaseAnonKey }: QaNextActionPlanClientProps) {
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
  const [state, setState] = useState<ActionPlanState>({ view: 'checking' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadActionPlanState(supabase, setState);
  }, [supabase]);

  async function reload(productId?: string) {
    setBusy(true);
    await loadActionPlanState(supabase, setState, productId);
    setBusy(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setState({ view: 'signed-out' });
  }

  function setFilter(filter: ActionFilter) {
    setState((current) => current.view === 'action-plan' ? { ...current, filter } : current);
  }

  function switchProduct(productId: string) {
    window.localStorage.setItem(ACTIVE_PRODUCT_KEY, productId);
    void reload(productId);
  }

  if (state.view === 'checking') {
    return (
      <main className={styles.shell}>
        <section className={styles.authCard}>
          <h1>Action Plan</h1>
          <p>Checking session...</p>
        </section>
      </main>
    );
  }

  if (state.view === 'signed-out') {
    return (
      <main className={styles.shell}>
        <section className={styles.authCard}>
          <h1>Action Plan</h1>
          <p>Sign in on the QA Next page first.</p>
          {state.error ? <div className={styles.error}>{state.error}</div> : null}
          <a className={styles.primaryLink} href="/qa-next">Open QA Next</a>
        </section>
      </main>
    );
  }

  if (state.view === 'password-required') {
    return (
      <main className={styles.shell}>
        <section className={styles.authCard}>
          <h1>Set a new password</h1>
          <p>{state.email} must finish the password-change gate before using Action Plan.</p>
          <a className={styles.primaryLink} href="/qa-next">Open QA Next</a>
        </section>
      </main>
    );
  }

  const activeProduct = state.products.find((product) => product.id === state.activeProductId) || state.products[0];
  const summary = summarizeActionPlan(state.actions);
  const filteredActions = filterActions(state.actions, state.filter);

  return (
    <main className={styles.dashboard}>
      <header className={styles.topbar}>
        <div>
          <span className={styles.eyebrow}>QA Next</span>
          <h1>Action Plan</h1>
        </div>
        <div className={styles.userPill}>
          <span>{state.profile.username || state.profile.email}</span>
          <strong>{state.profile.role}</strong>
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <section className={styles.adminToolbar}>
        <div>
          <strong>{summary.backlog}</strong>
          <span>Backlog</span>
        </div>
        <div>
          <strong>{summary.production}</strong>
          <span>Production</span>
        </div>
        <div className={summary.overdue ? styles.healthBad : styles.healthOk}>
          <strong>{summary.overdue}</strong>
          <span>Overdue</span>
        </div>
        <a href="/qa-next">Product switcher</a>
        <a href="/qa-next/creative-tracker">Creative Tracker</a>
        <a href="/qa-next/inspiration">Inspiration Queue</a>
        {state.profile.role === 'admin' ? <a href="/qa-next/admin">Admin</a> : null}
        <button disabled={busy} type="button" onClick={() => reload()}>
          {busy ? 'Refreshing...' : 'Refresh'}
        </button>
      </section>

      {state.error ? <div className={styles.error}>{state.error}</div> : null}

      <section className={styles.productBar}>
        <label>
          <span>Product</span>
          <select
            value={activeProduct?.id || ''}
            onChange={(event) => switchProduct(event.target.value)}
            disabled={!state.products.length || busy}
          >
            {state.products.map((product) => (
              <option key={product.id} value={product.id}>{product.name || product.id}</option>
            ))}
          </select>
        </label>
        <div className={styles.queueMeta}>
          <span>{activeProduct ? productClickUpListId(activeProduct) || 'No ClickUp list' : 'No product'}</span>
          <span>{summary.total} cards</span>
          <span>Loaded {formatDateTime(state.loadedAt)}</span>
        </div>
      </section>

      <section className={styles.actionGrid}>
        <section className={styles.queueMain}>
          <div className={styles.adminSectionHeader}>
            <div>
              <span className={styles.eyebrow}>Cards</span>
              <h2>Manual actions and linked ads</h2>
            </div>
            <select
              className={styles.filterSelect}
              value={state.filter}
              onChange={(event) => setFilter(event.target.value as ActionFilter)}
            >
              <option value="all">All cards</option>
              <option value="backlog">Backlog</option>
              <option value="production">Production</option>
              <option value="testing">Testing</option>
              <option value="winners">Winners</option>
              <option value="losers">Losers</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          <div className={styles.actionRows}>
            {filteredActions.length ? filteredActions.map((action) => (
              <article className={styles.actionRow} key={action.dbId || action.id}>
                <div className={styles.actionTitle}>
                  <div>
                    <strong>{action.title || 'Untitled action'}</strong>
                    <span>{[action.angle, action.persona].filter(Boolean).join(' x ') || 'No cell identity'}</span>
                  </div>
                  <span className={actionStatusClass(action.status, styles)}>{action.status}</span>
                </div>
                <dl className={styles.actionFacts}>
                  <div>
                    <dt>Due</dt>
                    <dd className={isActionOverdue(action) ? styles.overdueText : undefined}>
                      {action.dueDate || '-'}
                    </dd>
                  </div>
                  <div>
                    <dt>Type</dt>
                    <dd>{action.adType || '-'}</dd>
                  </div>
                  <div>
                    <dt>Stage</dt>
                    <dd>{action.funnelStage || '-'}</dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>{action.source.label || action.source.kind}</dd>
                  </div>
                </dl>
                <div className={styles.actionLinks}>
                  {action.clickupUrl ? <a href={action.clickupUrl} target="_blank" rel="noreferrer">ClickUp</a> : null}
                  {action.adLink ? <a href={action.adLink} target="_blank" rel="noreferrer">Ad</a> : null}
                  {action.driveLink ? <a href={action.driveLink} target="_blank" rel="noreferrer">Drive</a> : null}
                  {action.linkedAdId ? <span>{action.linkedAdId}</span> : <span>No linked ad</span>}
                  {action.clickupTaskDeleted ? <span className={styles.inactiveBadge}>Deleted in CU</span> : null}
                </div>
                {action.description ? <p className={styles.actionDescription}>{action.description}</p> : null}
              </article>
            )) : (
              <div className={styles.emptyState}>No Action Plan cards match this filter.</div>
            )}
          </div>
        </section>

        <aside className={styles.workerPanel}>
          <div>
            <span className={styles.eyebrow}>Summary</span>
            <h2>{summary.total} cards</h2>
          </div>
          <div className={styles.actionSummary}>
            <div><strong>{summary.testing}</strong><span>Testing</span></div>
            <div><strong>{summary.winners}</strong><span>Winners</span></div>
            <div><strong>{summary.losers}</strong><span>Losers</span></div>
          </div>
          <div className={styles.eventRows}>
            <div className={styles.adminSectionHeader}>
              <div>
                <span className={styles.eyebrow}>Activity</span>
                <h2>Recent events</h2>
              </div>
            </div>
            {state.events.length ? state.events.map((event) => (
              <article className={styles.eventRow} key={event.id}>
                <strong>{eventLabel(event)}</strong>
                <span>{[event.actor, event.source].filter(Boolean).join(' via ') || 'system'}</span>
                <small>{formatDateTime(event.created_at)}</small>
              </article>
            )) : (
              <div className={styles.emptyState}>No recent Action Plan events.</div>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

async function loadActionPlanState(
  supabase: SupabaseClient,
  setState: React.Dispatch<React.SetStateAction<ActionPlanState>>,
  requestedProductId?: string,
) {
  const sessionResult = await supabase.auth.getSession();
  const session = sessionResult.data.session;
  if (!session) {
    setState({ view: 'signed-out' });
    return;
  }

  const [profileResult, userProductsResult, productsResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', session.user.id).single(),
    supabase.from('user_products').select('product_id').eq('user_id', session.user.id),
    supabase.from('products').select('*').order('name', { ascending: true }),
  ]);

  if (profileResult.error || !profileResult.data) {
    setState({ view: 'signed-out', error: 'Profile not found. Contact your admin.' });
    return;
  }

  const profile = profileResult.data as Profile;
  if (!profile.is_active) {
    await supabase.auth.signOut();
    setState({ view: 'signed-out', error: 'Your account has been deactivated.' });
    return;
  }

  if (profile.must_change_password) {
    setState({ view: 'password-required', email: profile.email });
    return;
  }

  const allProducts = Array.isArray(productsResult.data)
    ? productsResult.data.map((row) => productRowToView(row) as Product).filter(Boolean)
    : [];
  const assignedProductIds = profile.role === 'admin' ? null : normalizeProductIds(userProductsResult.data || []);
  const products = resolveAccessibleProducts(profile, assignedProductIds || [], allProducts) as Product[];
  const savedProductId = requestedProductId || (typeof window !== 'undefined' ? window.localStorage.getItem(ACTIVE_PRODUCT_KEY) || '' : '');
  const activeProductId = resolveActiveProductId(savedProductId, products);
  if (activeProductId) window.localStorage.setItem(ACTIVE_PRODUCT_KEY, activeProductId);

  const [manualActionsResult, adsResult, eventsResult] = await Promise.all([
    activeProductId
      ? supabase
          .from('manual_actions')
          .select('id,product_id,payload,live_status,created_at,updated_at,approved_at,delivered_at,launched_at,killed_at,scaled_at')
          .eq('product_id', activeProductId)
          .order('updated_at', { ascending: false })
          .limit(160)
      : Promise.resolve({ data: [], error: null }),
    activeProductId
      ? supabase
          .from('ads')
          .select('*')
          .eq('product_id', activeProductId)
          .is('deleted_at', null)
          .limit(3000)
      : Promise.resolve({ data: [], error: null }),
    activeProductId
      ? supabase
          .from('activity_events')
          .select('id,event_type,action_id,clickup_task_id,field_name,new_value,actor,source,created_at')
          .eq('product_id', activeProductId)
          .order('created_at', { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const ads = Array.isArray(adsResult.data) ? adsResult.data.map(normalizeActionAd) : [];
  const actions = Array.isArray(manualActionsResult.data)
    ? manualActionsResult.data
        .map(normalizeManualActionRow)
        .map((action) => resolveActionDisplay(action, ads))
        .filter(Boolean) as ActionDisplay[]
    : [];

  setState({
    view: 'action-plan',
    session,
    profile,
    products,
    activeProductId,
    actions,
    events: Array.isArray(eventsResult.data) ? eventsResult.data as ActivityEvent[] : [],
    filter: 'all',
    loadedAt: new Date().toISOString(),
    error: productsResult.error || manualActionsResult.error || adsResult.error || eventsResult.error
      ? 'Some Action Plan data could not be loaded.'
      : undefined,
  });
}

function filterActions(actions: ActionDisplay[], filter: ActionFilter) {
  if (filter === 'all') return actions;
  if (filter === 'overdue') return actions.filter((action) => isActionOverdue(action));
  return actions.filter((action) => actionPlanBucket(action.status) === filter);
}

function actionStatusClass(status: string, css: typeof styles) {
  const bucket = actionPlanBucket(status);
  if (bucket === 'winners') return css.activeBadge;
  if (bucket === 'losers') return css.inactiveBadge;
  if (bucket === 'production' || bucket === 'testing') return css.roleMember;
  return css.pendingBadge;
}

function eventLabel(event: ActivityEvent) {
  const type = event.event_type.replaceAll('_', ' ');
  if (event.field_name && event.new_value) return `${type}: ${event.field_name} -> ${event.new_value}`;
  if (event.clickup_task_id) return `${type}: ${event.clickup_task_id}`;
  return type;
}

function formatDateTime(value: string | number | null | undefined) {
  const dateMs = timestampMs(value);
  if (!dateMs) return '';
  return new Date(dateMs).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
