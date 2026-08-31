'use client';

import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';

import {
  actionPlanBucket,
  isActionOverdue,
  normalizeActionAd,
  normalizeManualActionRow,
  resolveActionDisplay,
  summarizeActionPlan,
  timestampMs,
} from '../../lib/domain/action-plan.js';
import {
  normalizeProductIds,
  resolveAccessibleProducts,
  resolveActiveProductId,
} from '../../lib/domain/auth-access.js';
import {
  normalizeAdminUser,
  productAssignmentLabel,
  toggleProductAssignment,
} from '../../lib/domain/admin-users.js';
import {
  creativeFilterOptions,
  creativeStatusBucket,
  filterCreativeTrackerRows,
  normalizeCreativeRow,
  sortCreativeTrackerRows,
  summarizeCreativeTracker,
  usageCountForCreative,
  variationCountForCreative,
} from '../../lib/domain/creative-tracker.js';
import {
  isClaimStale,
  normalizeQueueJob,
  normalizeWorker,
  summarizeQueue,
} from '../../lib/domain/worker-queue.js';
import {
  productClickUpListId,
  productClickUpListName,
  productRowToView,
} from '../../lib/domain/product-config.js';
import {
  deriveTaxonomyStatus,
  filterTaxonomyRows,
  newTaxonomyId,
  normalizeTaxonomyName,
  normalizeTaxonomyRow,
  summarizeTaxonomyRows,
  taxonomyStats,
} from '../../lib/domain/taxonomy.js';
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

type ActiveTab = 'overview' | 'angles' | 'personas' | 'action-plan' | 'creative-tracker' | 'inspiration' | 'admin';
type ActionDisplay = NonNullable<ReturnType<typeof resolveActionDisplay>>;
type ActionFilter = 'all' | 'backlog' | 'production' | 'testing' | 'winners' | 'losers' | 'overdue';
type QueueJob = ReturnType<typeof normalizeQueueJob>;
type WorkerRow = ReturnType<typeof normalizeWorker>;
type QueueFilter = 'all' | 'pending' | 'active' | 'classified' | 'failed';
type Creative = ReturnType<typeof normalizeCreativeRow>;
type TaxonomyKind = 'angle' | 'persona';
type TaxonomyRow = ReturnType<typeof normalizeTaxonomyRow>;
type TaxonomyView = 'active' | 'archived' | 'all';
type TrackerSortColumn = 'id' | 'formatName' | 'status' | 'dateCreated';
type TrackerSort = { col: TrackerSortColumn; dir: 1 | -1 };
type TrackerFilters = {
  angle: string;
  persona: string;
  format: string;
  adType: string;
  funnelStage: string;
  status: string;
  structure: string;
  hookType: string;
  productionStyle: string;
  taskType: '' | 'format' | 'production';
  dateRange: '' | 'today' | 'week' | 'month';
};
type MatrixCell = {
  id: string;
  angle_id: string;
  persona_id: string;
  creative_assignments: string[];
};
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

type AppState =
  | { view: 'checking'; message?: string }
  | { view: 'login'; error?: string }
  | { view: 'password'; session: Session; user: User; profile: Profile; error?: string }
  | {
      view: 'dashboard';
      session: Session;
      user: User;
      profile: Profile;
      products: Product[];
      activeProductId: string;
      activeTab: ActiveTab;
      error?: string;
    };

type QaNextClientProps = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

const ACTIVE_PRODUCT_KEY = 'immuvi_active_product';
const ACTIVE_TAB_KEY = 'immuvi_qa_next_active_tab';
const defaultTrackerFilters: TrackerFilters = {
  angle: '',
  persona: '',
  format: '',
  adType: '',
  funnelStage: '',
  status: '',
  structure: '',
  hookType: '',
  productionStyle: '',
  taskType: '',
  dateRange: '',
};
const emptyCreateForm: CreateUserForm = {
  email: '',
  username: '',
  fullName: '',
  role: 'member',
  tempPassword: '',
  productIds: [],
};

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

    await loadAuthedState(supabase, result.data.session, setState);
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
      await loadAuthedState(supabase, state.session, setState);
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

  function setActiveTab(activeTab: ActiveTab) {
    window.localStorage.setItem(ACTIVE_TAB_KEY, activeTab);
    setState((current) => current.view === 'dashboard' ? { ...current, activeTab } : current);
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
  const tabs = commandTabs(state.profile);

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
        <div className={styles.queueMeta}>
          <span>{activeProduct ? productClickUpListName(activeProduct) || productClickUpListId(activeProduct) || 'No ClickUp list' : 'No product'}</span>
          <a className={styles.legacyLink} href="/immuvi-command-center.html">Legacy dashboard</a>
        </div>
      </section>

      {state.error ? <div className={styles.error}>{state.error}</div> : null}

      <nav className={styles.commandTabs} aria-label="Command Center sections">
        {tabs.map((tab) => (
          <button
            aria-selected={state.activeTab === tab.id}
            className={state.activeTab === tab.id ? styles.commandTabActive : ''}
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.label}</span>
            <small>{tab.caption}</small>
          </button>
        ))}
      </nav>

      <section className={styles.tabPanel}>
        {state.activeTab === 'overview' ? (
          <OverviewTab profile={state.profile} products={state.products} activeProduct={activeProduct} switchProduct={switchProduct} />
        ) : null}
        {state.activeTab === 'angles' ? (
          <TaxonomyTab kind="angle" supabase={supabase} activeProductId={state.activeProductId} />
        ) : null}
        {state.activeTab === 'personas' ? (
          <TaxonomyTab kind="persona" supabase={supabase} activeProductId={state.activeProductId} />
        ) : null}
        {state.activeTab === 'action-plan' ? (
          <ActionPlanTab supabase={supabase} activeProductId={state.activeProductId} activeProduct={activeProduct} />
        ) : null}
        {state.activeTab === 'creative-tracker' ? (
          <CreativeTrackerTab supabase={supabase} activeProductId={state.activeProductId} activeProduct={activeProduct} />
        ) : null}
        {state.activeTab === 'inspiration' ? (
          <InspirationTab supabase={supabase} activeProductId={state.activeProductId} activeProduct={activeProduct} />
        ) : null}
        {state.activeTab === 'admin' && state.profile.role === 'admin' ? (
          <AdminTab supabase={supabase} session={state.session} />
        ) : null}
      </section>
    </main>
  );
}

function OverviewTab({
  profile,
  products,
  activeProduct,
  switchProduct,
}: {
  profile: Profile;
  products: Product[];
  activeProduct?: Product;
  switchProduct: (productId: string) => void;
}) {
  return (
    <section className={styles.grid}>
      <article className={styles.panel}>
        <span className={styles.eyebrow}>Active Product</span>
        <h2>{activeProduct?.name || 'No products assigned'}</h2>
        <dl>
          <div><dt>Product ID</dt><dd>{activeProduct?.id || '-'}</dd></div>
          <div><dt>ClickUp List</dt><dd>{activeProduct ? productClickUpListName(activeProduct) || productClickUpListId(activeProduct) || '-' : '-'}</dd></div>
          <div><dt>ClickUp List ID</dt><dd>{activeProduct ? productClickUpListId(activeProduct) || '-' : '-'}</dd></div>
        </dl>
      </article>

      <article className={styles.panel}>
        <span className={styles.eyebrow}>Access</span>
        <h2>{profile.role === 'admin' ? 'All products' : `${products.length} assigned`}</h2>
        <div className={styles.productList}>
          {products.map((product) => (
            <button className={product.id === activeProduct?.id ? styles.activeProduct : ''} key={product.id} type="button" onClick={() => switchProduct(product.id)}>
              <span>{product.name || product.id}</span>
              <small>{productClickUpListId(product) || 'No ClickUp list'}</small>
            </button>
          ))}
        </div>
      </article>
    </section>
  );
}

function TaxonomyTab({ kind, supabase, activeProductId }: { kind: TaxonomyKind; supabase: SupabaseClient; activeProductId: string }) {
  const [rows, setRows] = useState<TaxonomyRow[]>([]);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [drafts, setDrafts] = useState<Record<string, TaxonomyRow>>({});
  const [view, setView] = useState<TaxonomyView>('active');
  const [loadedAt, setLoadedAt] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const tableName = taxonomyTable(kind);
  const columnName = taxonomyColumn(kind);
  const label = taxonomyLabel(kind);
  const oppositeLabel = kind === 'angle' ? 'personas' : 'angles';

  useEffect(() => {
    void reload();
  }, [activeProductId, tableName]);

  async function reload(options: { notice?: string } = {}) {
    if (!activeProductId) return;
    setBusyAction('reload');
    const [rowsResult, adsResult] = await Promise.all([
      supabase.from(tableName).select('id,product_id,name,status,source_link,notes,created_at,updated_at,archived_at').eq('product_id', activeProductId).order('created_at', { ascending: true }),
      supabase.from('ads').select('id,product_id,format_name,status,angle,persona,parent_ad_id,meta,deleted_at').eq('product_id', activeProductId).is('deleted_at', null).limit(3000),
    ]);
    const nextRows = Array.isArray(rowsResult.data) ? rowsResult.data.map(normalizeTaxonomyRow) : [];
    setRows(nextRows);
    setDrafts(Object.fromEntries(nextRows.map((row) => [row.id, row])));
    setCreatives(Array.isArray(adsResult.data) ? adsResult.data.map(normalizeCreativeRow) : []);
    setLoadedAt(new Date().toISOString());
    setNotice(options.notice || '');
    setError(rowsResult.error || adsResult.error ? `Some ${label.toLowerCase()} data could not be loaded.` : '');
    setBusyAction('');
  }

  async function addRow() {
    const name = nextTaxonomyName(`New ${label}`, rows);
    const id = newTaxonomyId(kind, rows);
    setBusyAction('add');
    const result = await supabase.from(tableName).insert({
      id,
      product_id: activeProductId,
      name,
      status: 'Untested',
      source_link: '',
      notes: '',
    });
    if (result.error) {
      setError(result.error.message);
      setBusyAction('');
      return;
    }
    await reload({ notice: `${label} added.` });
  }

  async function saveRow(row: TaxonomyRow) {
    const draft = drafts[row.id] || row;
    const nextName = normalizeTaxonomyName(draft.name) || row.name;
    if (rows.some((candidate) => candidate.id !== row.id && candidate.name.toLowerCase() === nextName.toLowerCase())) {
      setError(`${label} "${nextName}" already exists.`);
      return;
    }
    if (nextName !== row.name && !window.confirm(`Rename ${label.toLowerCase()} "${row.name}" to "${nextName}"?\n\nRelated creatives and inspirations will be retagged.`)) {
      setDrafts((current) => ({ ...current, [row.id]: row }));
      return;
    }

    setBusyAction(`save:${row.id}`);
    const update = await supabase.from(tableName).update({
      name: nextName,
      source_link: draft.sourceLink.trim(),
      notes: draft.notes.trim(),
      updated_at: new Date().toISOString(),
    }).eq('id', row.id);
    if (update.error) {
      setError(update.error.message);
      setBusyAction('');
      return;
    }

    if (nextName !== row.name) {
      const [adsUpdate, inspirationsUpdate] = await Promise.all([
        supabase.from('ads').update({ [columnName]: nextName, updated_at: new Date().toISOString() }).eq('product_id', activeProductId).eq(columnName, row.name),
        supabase.from('inspirations').update({ [columnName]: nextName, updated_at: new Date().toISOString() }).eq('product_id', activeProductId).eq(columnName, row.name),
      ]);
      if (adsUpdate.error || inspirationsUpdate.error) {
        setError(`Saved ${label.toLowerCase()}, but some related rows could not be retagged.`);
        setBusyAction('');
        return;
      }
    }

    await reload({ notice: `${label} saved.` });
  }

  async function setArchived(row: TaxonomyRow, archived: boolean) {
    if (archived && !window.confirm(`Archive ${label.toLowerCase()} "${row.name}"?\n\nIt will be hidden from active taxonomy views. Existing creatives keep their tagging.`)) return;
    setBusyAction(`archive:${row.id}`);
    const result = await supabase.from(tableName).update({
      archived_at: archived ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', row.id);
    if (result.error) {
      setError(result.error.message);
      setBusyAction('');
      return;
    }
    await reload({ notice: `${row.name} ${archived ? 'archived' : 'restored'}.` });
  }

  async function deleteRow(row: TaxonomyRow) {
    if (!window.confirm(`Delete ${label.toLowerCase()} "${row.name}"?\n\nThis will clear it from related creatives and inspirations.`)) return;
    setBusyAction(`delete:${row.id}`);
    const [adsUpdate, inspirationsUpdate] = await Promise.all([
      supabase.from('ads').update({ [columnName]: '', updated_at: new Date().toISOString() }).eq('product_id', activeProductId).eq(columnName, row.name),
      supabase.from('inspirations').update({ [columnName]: '', updated_at: new Date().toISOString() }).eq('product_id', activeProductId).eq(columnName, row.name),
    ]);
    const deletion = await supabase.from(tableName).delete().eq('id', row.id);
    if (adsUpdate.error || inspirationsUpdate.error || deletion.error) {
      setError(`Delete failed: ${(adsUpdate.error || inspirationsUpdate.error || deletion.error)?.message || 'unknown error'}`);
      setBusyAction('');
      return;
    }
    await reload({ notice: `${label} deleted.` });
  }

  function setDraftField(row: TaxonomyRow, field: keyof Pick<TaxonomyRow, 'name' | 'sourceLink' | 'notes'>, value: string) {
    setDrafts((current) => ({ ...current, [row.id]: { ...(current[row.id] || row), [field]: value } }));
  }

  const summary = summarizeTaxonomyRows(kind, rows, creatives);
  const visibleRows = filterTaxonomyRows(rows, view);

  return (
    <>
      <section className={styles.adminToolbar}>
        <div><strong>{summary.total}</strong><span>{label}s</span></div>
        <div><strong>{summary.winners}</strong><span>Winners</span></div>
        <div><strong>{summary.totalCreatives}</strong><span>Creatives</span></div>
        <button disabled={Boolean(busyAction)} type="button" onClick={addRow}>{busyAction === 'add' ? 'Adding...' : `Add ${label}`}</button>
        <button disabled={busyAction === 'reload'} type="button" onClick={() => reload()}>{busyAction === 'reload' ? 'Refreshing...' : 'Refresh'}</button>
      </section>
      {notice ? <div className={styles.notice}>{notice}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}
      <section className={styles.productBar}>
        <div className={styles.queueMeta}>
          <span>{summary.active} active</span>
          <span>{summary.archived} archived</span>
          <span>{summary.testing} testing</span>
          <span>{summary.untested} untested</span>
          <span>Loaded {formatDateTime(loadedAt)}</span>
        </div>
        <div className={styles.segmented}>
          <button className={view === 'active' ? styles.segmentActive : ''} type="button" onClick={() => setView('active')}>Active</button>
          <button className={view === 'archived' ? styles.segmentActive : ''} type="button" onClick={() => setView('archived')}>Archived</button>
          <button className={view === 'all' ? styles.segmentActive : ''} type="button" onClick={() => setView('all')}>All</button>
        </div>
      </section>
      <section className={styles.taxonomyPanel}>
        <div className={styles.adminSectionHeader}>
          <div><span className={styles.eyebrow}>{label}s</span><h2>{label} strategy tracker</h2></div>
        </div>
        <div className={styles.taxonomyRows}>
          {visibleRows.length ? visibleRows.map((row, index) => {
            const draft = drafts[row.id] || row;
            const derivedStatus = deriveTaxonomyStatus(kind, row.name, creatives);
            const stats = taxonomyStats(kind, row.name, creatives);
            const changed = draft.name !== row.name || draft.sourceLink !== row.sourceLink || draft.notes !== row.notes;
            return (
              <article className={row.archivedAt ? styles.taxonomyRowArchived : styles.taxonomyRow} key={row.id}>
                <div className={styles.taxonomyIndex}>{index + 1}</div>
                <label className={styles.taxonomyName}>
                  <span>{label} Name</span>
                  <input value={draft.name} onChange={(event) => setDraftField(row, 'name', event.target.value)} />
                </label>
                <div className={styles.statusStack}>
                  <span className={creativeStatusClass(derivedStatus, styles)}>{derivedStatus}</span>
                  {row.archivedAt ? <span className={styles.inactiveBadge}>Archived</span> : null}
                </div>
                <label className={styles.taxonomySource}>
                  <span>Source Link</span>
                  <input value={draft.sourceLink} placeholder="https://" onChange={(event) => setDraftField(row, 'sourceLink', event.target.value)} />
                </label>
                <div className={styles.taxonomyStats}>
                  <span>{stats.relatedCount} {oppositeLabel}</span>
                  <span>{stats.creatives} creatives</span>
                  <span>{stats.winRate}% win</span>
                </div>
                <label className={styles.taxonomyNotes}>
                  <span>Notes</span>
                  <textarea value={draft.notes} rows={2} onChange={(event) => setDraftField(row, 'notes', event.target.value)} />
                </label>
                <div className={styles.rowActions}>
                  <button disabled={!changed || busyAction === `save:${row.id}`} type="button" onClick={() => saveRow(row)}>{busyAction === `save:${row.id}` ? 'Saving...' : 'Save'}</button>
                  <button disabled={busyAction === `archive:${row.id}`} type="button" onClick={() => setArchived(row, !row.archivedAt)}>{row.archivedAt ? 'Restore' : 'Archive'}</button>
                  <button disabled={busyAction === `delete:${row.id}`} type="button" onClick={() => deleteRow(row)}>Delete</button>
                </div>
              </article>
            );
          }) : <div className={styles.emptyState}>No {label.toLowerCase()}s in this view.</div>}
        </div>
      </section>
    </>
  );
}

function ActionPlanTab({ supabase, activeProductId, activeProduct }: { supabase: SupabaseClient; activeProductId: string; activeProduct?: Product }) {
  const [actions, setActions] = useState<ActionDisplay[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [filter, setFilter] = useState<ActionFilter>('all');
  const [loadedAt, setLoadedAt] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void reload();
  }, [activeProductId]);

  async function reload() {
    if (!activeProductId) return;
    setBusy(true);
    const [manualActionsResult, adsResult, eventsResult] = await Promise.all([
      supabase.from('manual_actions').select('id,product_id,payload,live_status,created_at,updated_at,approved_at,delivered_at,launched_at,killed_at,scaled_at').eq('product_id', activeProductId).order('updated_at', { ascending: false }).limit(160),
      supabase.from('ads').select('*').eq('product_id', activeProductId).is('deleted_at', null).limit(3000),
      supabase.from('activity_events').select('id,event_type,action_id,clickup_task_id,field_name,new_value,actor,source,created_at').eq('product_id', activeProductId).order('created_at', { ascending: false }).limit(40),
    ]);
    const ads = Array.isArray(adsResult.data) ? adsResult.data.map(normalizeActionAd) : [];
    const nextActions = Array.isArray(manualActionsResult.data)
      ? manualActionsResult.data.map(normalizeManualActionRow).map((action) => resolveActionDisplay(action, ads)).filter(Boolean) as ActionDisplay[]
      : [];
    setActions(nextActions);
    setEvents(Array.isArray(eventsResult.data) ? eventsResult.data as ActivityEvent[] : []);
    setLoadedAt(new Date().toISOString());
    setError(manualActionsResult.error || adsResult.error || eventsResult.error ? 'Some Action Plan data could not be loaded.' : '');
    setBusy(false);
  }

  const summary = summarizeActionPlan(actions);
  const filtered = filter === 'all' ? actions : actions.filter((action) => filter === 'overdue' ? isActionOverdue(action) : actionPlanBucket(action.status) === filter);

  return (
    <>
      <section className={styles.adminToolbar}>
        <div><strong>{summary.backlog}</strong><span>Backlog</span></div>
        <div><strong>{summary.production}</strong><span>Production</span></div>
        <div className={summary.overdue ? styles.healthBad : styles.healthOk}><strong>{summary.overdue}</strong><span>Overdue</span></div>
        <button disabled={busy} type="button" onClick={reload}>{busy ? 'Refreshing...' : 'Refresh'}</button>
      </section>
      {error ? <div className={styles.error}>{error}</div> : null}
      <section className={styles.productBar}>
        <div className={styles.queueMeta}>
          <span>{activeProduct ? productClickUpListId(activeProduct) || 'No ClickUp list' : 'No product'}</span>
          <span>{summary.total} cards</span>
          <span>Loaded {formatDateTime(loadedAt)}</span>
        </div>
        <select className={styles.filterSelect} value={filter} onChange={(event) => setFilter(event.target.value as ActionFilter)}>
          <option value="all">All cards</option>
          <option value="backlog">Backlog</option>
          <option value="production">Production</option>
          <option value="testing">Testing</option>
          <option value="winners">Winners</option>
          <option value="losers">Losers</option>
          <option value="overdue">Overdue</option>
        </select>
      </section>
      <section className={styles.actionGrid}>
        <section className={styles.queueMain}>
          <div className={styles.adminSectionHeader}><div><span className={styles.eyebrow}>Action Plan</span><h2>Manual actions and linked ads</h2></div></div>
          <div className={styles.actionRows}>
            {filtered.length ? filtered.map((action) => (
              <article className={styles.actionRow} key={action.dbId || action.id}>
                <div className={styles.actionTitle}>
                  <div><strong>{action.title || 'Untitled action'}</strong><span>{[action.angle, action.persona].filter(Boolean).join(' x ') || 'No cell identity'}</span></div>
                  <span className={actionStatusClass(action.status, styles)}>{action.status}</span>
                </div>
                <dl className={styles.actionFacts}>
                  <div><dt>Due</dt><dd className={isActionOverdue(action) ? styles.overdueText : undefined}>{action.dueDate || '-'}</dd></div>
                  <div><dt>Type</dt><dd>{action.adType || '-'}</dd></div>
                  <div><dt>Stage</dt><dd>{action.funnelStage || '-'}</dd></div>
                  <div><dt>Source</dt><dd>{action.source.label || action.source.kind}</dd></div>
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
            )) : <div className={styles.emptyState}>No Action Plan cards match this filter.</div>}
          </div>
        </section>
        <aside className={styles.workerPanel}>
          <div><span className={styles.eyebrow}>Summary</span><h2>{summary.total} cards</h2></div>
          <div className={styles.actionSummary}>
            <div><strong>{summary.testing}</strong><span>Testing</span></div>
            <div><strong>{summary.winners}</strong><span>Winners</span></div>
            <div><strong>{summary.losers}</strong><span>Losers</span></div>
          </div>
          <div className={styles.eventRows}>
            <div className={styles.adminSectionHeader}><div><span className={styles.eyebrow}>Activity</span><h2>Recent events</h2></div></div>
            {events.length ? events.map((event) => (
              <article className={styles.eventRow} key={event.id}>
                <strong>{eventLabel(event)}</strong>
                <span>{[event.actor, event.source].filter(Boolean).join(' via ') || 'system'}</span>
                <small>{formatDateTime(event.created_at)}</small>
              </article>
            )) : <div className={styles.emptyState}>No recent Action Plan events.</div>}
          </div>
        </aside>
      </section>
    </>
  );
}

function CreativeTrackerTab({ supabase, activeProductId, activeProduct }: { supabase: SupabaseClient; activeProductId: string; activeProduct?: Product }) {
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [matrixCells, setMatrixCells] = useState<MatrixCell[]>([]);
  const [filters, setFilters] = useState<TrackerFilters>(defaultTrackerFilters);
  const [sort, setSortState] = useState<TrackerSort>({ col: 'id', dir: 1 });
  const [loadedAt, setLoadedAt] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFilters({ ...defaultTrackerFilters });
    void reload();
  }, [activeProductId]);

  async function reload() {
    if (!activeProductId) return;
    setBusy(true);
    const [adsResult, matrixCellsResult] = await Promise.all([
      supabase.from('ads').select('*').eq('product_id', activeProductId).is('deleted_at', null).limit(3000),
      supabase.from('matrix_cells').select('id,angle_id,persona_id,creative_assignments').eq('product_id', activeProductId).limit(3000),
    ]);
    setCreatives(Array.isArray(adsResult.data) ? adsResult.data.map(normalizeCreativeRow) : []);
    setMatrixCells(Array.isArray(matrixCellsResult.data) ? matrixCellsResult.data as MatrixCell[] : []);
    setLoadedAt(new Date().toISOString());
    setError(adsResult.error || matrixCellsResult.error ? 'Some Creative Tracker data could not be loaded.' : '');
    setBusy(false);
  }

  function setFilter<K extends keyof TrackerFilters>(key: K, value: TrackerFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function setSort(col: TrackerSortColumn) {
    setSortState((current) => ({ col, dir: current.col === col && current.dir === 1 ? -1 : 1 }));
  }

  const summary = summarizeCreativeTracker(creatives);
  const options = creativeFilterOptions(creatives);
  const filtered = sortCreativeTrackerRows(filterCreativeTrackerRows(creatives, filters), sort);

  return (
    <>
      <section className={styles.adminToolbar}>
        <div><strong>{summary.total}</strong><span>Creatives</span></div>
        <div><strong>{summary.production}</strong><span>Production</span></div>
        <div className={summary.missingLinks ? styles.healthBad : styles.healthOk}><strong>{summary.missingLinks}</strong><span>Missing links</span></div>
        <button disabled={busy} type="button" onClick={reload}>{busy ? 'Refreshing...' : 'Refresh'}</button>
      </section>
      {error ? <div className={styles.error}>{error}</div> : null}
      <section className={styles.productBar}>
        <div className={styles.queueMeta}>
          <span>{activeProduct ? productClickUpListId(activeProduct) || 'No ClickUp list' : 'No product'}</span>
          <span>{filtered.length} shown</span>
          <span>Loaded {formatDateTime(loadedAt)}</span>
        </div>
      </section>
      <section className={styles.trackerFilters}>
        <div className={styles.segmented}>
          <button className={filters.taskType === '' ? styles.segmentActive : ''} type="button" onClick={() => setFilter('taskType', '')}>All</button>
          <button className={filters.taskType === 'format' ? styles.segmentActive : ''} type="button" onClick={() => setFilter('taskType', 'format')}>Formats</button>
          <button className={filters.taskType === 'production' ? styles.segmentActive : ''} type="button" onClick={() => setFilter('taskType', 'production')}>Production</button>
        </div>
        <FilterSelect label="All angles" value={filters.angle} values={options.angles} onChange={(value) => setFilter('angle', value)} />
        <FilterSelect label="All personas" value={filters.persona} values={options.personas} onChange={(value) => setFilter('persona', value)} />
        <FilterSelect label="All formats" value={filters.format} values={options.formats} onChange={(value) => setFilter('format', value)} />
        <FilterSelect label="All structures" value={filters.structure} values={options.structures} onChange={(value) => setFilter('structure', value)} />
        <FilterSelect label="All hooks" value={filters.hookType} values={options.hookTypes} onChange={(value) => setFilter('hookType', value)} />
        <FilterSelect label="All production" value={filters.productionStyle} values={options.productionStyles} onChange={(value) => setFilter('productionStyle', value)} />
        <FilterSelect label="All ad types" value={filters.adType} values={options.adTypes} onChange={(value) => setFilter('adType', value)} />
        <FilterSelect label="All funnels" value={filters.funnelStage} values={options.funnelStages} onChange={(value) => setFilter('funnelStage', value)} />
        <FilterSelect label="All statuses" value={filters.status} values={options.statuses} onChange={(value) => setFilter('status', value)} />
        <select value={filters.dateRange} onChange={(event) => setFilter('dateRange', event.target.value as TrackerFilters['dateRange'])}>
          <option value="">All time</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
        <button type="button" onClick={() => setFilters({ ...defaultTrackerFilters })}>Clear</button>
      </section>
      <section className={styles.creativeTrackerGrid}>
        <section className={styles.queueMain}>
          <div className={styles.adminSectionHeader}>
            <div><span className={styles.eyebrow}>Creative Tracker</span><h2>Creative inventory</h2></div>
            <div className={styles.sortButtons}>
              <button type="button" onClick={() => setSort('formatName')}>Name {sortMark(sort, 'formatName')}</button>
              <button type="button" onClick={() => setSort('status')}>Status {sortMark(sort, 'status')}</button>
              <button type="button" onClick={() => setSort('dateCreated')}>Created {sortMark(sort, 'dateCreated')}</button>
            </div>
          </div>
          <div className={styles.creativeRows}>
            {filtered.length ? filtered.map((creative) => (
              <article className={creative.taskType === 'production' ? styles.productionCreativeRow : styles.creativeRow} key={creative.id}>
                <div className={styles.creativeTitle}>
                  <div><strong>{creative.formatName || creative.id}</strong><span>{[creative.angle, creative.persona].filter(Boolean).join(' x ') || 'No matrix cell'}</span></div>
                  <span className={creativeStatusClass(creative.status, styles)}>{creative.status}</span>
                </div>
                <dl className={styles.creativeFacts}>
                  <div><dt>Structure</dt><dd>{creative.creativeStructure || '-'}</dd></div>
                  <div><dt>Hook</dt><dd>{creative.hookType || '-'}</dd></div>
                  <div><dt>Production</dt><dd>{creative.productionStyle || '-'}</dd></div>
                  <div><dt>Type</dt><dd>{creative.adType || '-'}</dd></div>
                  <div><dt>Funnel</dt><dd>{creative.funnelStage || '-'}</dd></div>
                  <div><dt>Created</dt><dd>{formatDate(creative.dateCreated)}</dd></div>
                  <div><dt>Variations</dt><dd>{variationCountForCreative(creative, creatives)}</dd></div>
                  <div><dt>Usage</dt><dd>{creative.taskType === 'production' ? '1 cell' : usageCountForCreative(creative, creatives, matrixCells)}</dd></div>
                </dl>
                <div className={styles.actionLinks}>
                  {creative._clickupUrl ? <a href={creative._clickupUrl} target="_blank" rel="noreferrer">ClickUp</a> : null}
                  {creative.adLink ? <a href={creative.adLink} target="_blank" rel="noreferrer">Inspiration</a> : null}
                  {creative.driveLink ? <a href={creative.driveLink} target="_blank" rel="noreferrer">Drive</a> : null}
                  {creative.fromInspoId ? <span>{creative.fromInspoId}</span> : null}
                  {creative.sourceFormatId ? <span>From {creative.sourceFormatName || creative.sourceFormatId}</span> : null}
                  {creative.adOrigin === 'Winner Variation' ? <span>Winner variation</span> : null}
                  {creative.taskType === 'production' ? <span className={styles.roleMember}>Production</span> : null}
                </div>
                {creative.creativeHypothesis ? <p className={styles.actionDescription}>{creative.creativeHypothesis}</p> : null}
              </article>
            )) : <div className={styles.emptyState}>No creatives match your filters.</div>}
          </div>
        </section>
        <aside className={styles.workerPanel}>
          <div><span className={styles.eyebrow}>Summary</span><h2>{summary.total} visible rows</h2></div>
          <div className={styles.actionSummary}>
            <div><strong>{summary.formats}</strong><span>Formats</span></div>
            <div><strong>{summary.winnerVariations}</strong><span>Variations</span></div>
            <div><strong>{summary.ready}</strong><span>Ready</span></div>
            <div><strong>{summary.testing}</strong><span>Testing</span></div>
            <div><strong>{summary.winners}</strong><span>Winners</span></div>
            <div><strong>{summary.missingLinks}</strong><span>No links</span></div>
          </div>
        </aside>
      </section>
    </>
  );
}

function InspirationTab({ supabase, activeProductId, activeProduct }: { supabase: SupabaseClient; activeProductId: string; activeProduct?: Product }) {
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [loadedAt, setLoadedAt] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void reload();
  }, [activeProductId]);

  async function reload() {
    if (!activeProductId) return;
    setBusy(true);
    const [queueResult, workersResult] = await Promise.all([
      supabase.from('inspiration_queue').select('id,ins_id,product_id,url,platform,status,error_message,queued_at,processed_at,claimed_by,claimed_at,worker_assignment,attempts').eq('product_id', activeProductId).order('queued_at', { ascending: false }).limit(80),
      supabase.from('worker_registry').select('worker_id,hostname,os,python_version,claude_code_version,last_heartbeat,last_job_at,jobs_completed_total,jobs_failed_total,status,current_job_id,capabilities,enabled,created_at').order('last_heartbeat', { ascending: false }),
    ]);
    setJobs(Array.isArray(queueResult.data) ? queueResult.data.map(normalizeQueueJob) : []);
    setWorkers(Array.isArray(workersResult.data) ? workersResult.data.map((row) => normalizeWorker(row)) : []);
    setLoadedAt(new Date().toISOString());
    setError(queueResult.error || workersResult.error ? 'Some queue data could not be loaded.' : '');
    setBusy(false);
  }

  const summary = summarizeQueue(jobs);
  const filteredJobs = filterJobs(jobs, filter);
  const healthyWorkers = workers.filter((worker) => ['online', 'busy'].includes(worker.health)).length;

  return (
    <>
      <section className={styles.adminToolbar}>
        <div><strong>{summary.pending}</strong><span>Pending</span></div>
        <div><strong>{summary.active}</strong><span>Active</span></div>
        <div className={summary.failed ? styles.healthBad : styles.healthOk}><strong>{summary.failed}</strong><span>Failed</span></div>
        <button disabled={busy} type="button" onClick={reload}>{busy ? 'Refreshing...' : 'Refresh'}</button>
      </section>
      {error ? <div className={styles.error}>{error}</div> : null}
      <section className={styles.productBar}>
        <div className={styles.queueMeta}>
          <span>{activeProduct ? productClickUpListId(activeProduct) || 'No ClickUp list' : 'No product'}</span>
          <span>Loaded {formatDateTime(loadedAt)}</span>
        </div>
        <select className={styles.filterSelect} value={filter} onChange={(event) => setFilter(event.target.value as QueueFilter)}>
          <option value="all">All rows</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="classified">Classified</option>
          <option value="failed">Failed</option>
        </select>
      </section>
      <section className={styles.queueGrid}>
        <section className={styles.queueMain}>
          <div className={styles.adminSectionHeader}><div><span className={styles.eyebrow}>Inspiration Queue</span><h2>Recent queue rows</h2></div></div>
          <div className={styles.queueRows}>
            {filteredJobs.length ? filteredJobs.map((job) => (
              <article className={styles.queueRow} key={job.id}>
                <div className={styles.jobTitle}><strong>{job.insId || job.id}</strong><a href={job.url} target="_blank" rel="noreferrer">{job.platform || 'source'}</a></div>
                <div className={styles.statusStack}>
                  <span className={queueStatusClass(job.status, styles)}>{job.status}</span>
                  {isClaimStale(job) ? <span className={styles.inactiveBadge}>Stale claim</span> : null}
                  {job.workerAssignment !== 'auto' ? <span className={styles.pendingBadge}>{job.workerAssignment}</span> : null}
                </div>
                <dl className={styles.queueFacts}>
                  <div><dt>Queued</dt><dd>{formatDateTime(job.queuedAt)}</dd></div>
                  <div><dt>Claimed</dt><dd>{job.claimedBy || '-'}</dd></div>
                  <div><dt>Attempts</dt><dd>{job.attempts}</dd></div>
                  <div><dt>Processed</dt><dd>{formatDateTime(job.processedAt) || '-'}</dd></div>
                </dl>
                {job.errorMessage ? <p className={styles.queueError}>{job.errorMessage}</p> : null}
              </article>
            )) : <div className={styles.emptyState}>No queue rows match this filter.</div>}
          </div>
        </section>
        <aside className={styles.workerPanel}>
          <div><span className={styles.eyebrow}>Workers</span><h2>{healthyWorkers}/{workers.length} healthy</h2></div>
          <div className={styles.workerRows}>
            {workers.length ? workers.map((worker) => (
              <article className={styles.workerRow} key={worker.workerId}>
                <div><strong>{worker.workerId}</strong><span>{worker.hostname || worker.os || 'unknown host'}</span></div>
                <span className={workerHealthClass(worker.health, styles)}>{worker.health}</span>
                <dl>
                  <div><dt>Heartbeat</dt><dd>{formatAge(worker.heartbeatAgeMs)}</dd></div>
                  <div><dt>Last Job</dt><dd>{formatDateTime(worker.lastJobAt) || '-'}</dd></div>
                  <div><dt>Done / Failed</dt><dd>{worker.jobsCompletedTotal} / {worker.jobsFailedTotal}</dd></div>
                  <div><dt>Contract</dt><dd>{capabilityText(worker.capabilities, 'worker_contract') || '-'}</dd></div>
                </dl>
              </article>
            )) : <div className={styles.emptyState}>No workers registered in QA yet.</div>}
          </div>
        </aside>
      </section>
    </>
  );
}

function AdminTab({ supabase, session }: { supabase: SupabaseClient; session: Session }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [createForm, setCreateForm] = useState<CreateUserForm>(emptyCreateForm);
  const [healthOk, setHealthOk] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busyAction, setBusyAction] = useState('');

  useEffect(() => {
    void reload();
  }, []);

  async function adminApi(op: string, body: Record<string, unknown>) {
    const response = await fetch(`/api/admin/${op}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || `Admin API failed with HTTP ${response.status}`);
    return json;
  }

  async function reload(options: { notice?: string } = {}) {
    const [healthResult, usersResult, productsResult] = await Promise.all([
      adminApi('health', {}).then(() => true).catch(() => false),
      supabase.from('profiles_with_products').select('*').order('email', { ascending: true }),
      supabase.from('products').select('*').order('name', { ascending: true }),
    ]);
    const nextUsers = Array.isArray(usersResult.data) ? usersResult.data.map(normalizeAdminUser) as AdminUser[] : [];
    setUsers(nextUsers);
    setProducts(Array.isArray(productsResult.data) ? productsResult.data.map((row) => productRowToView(row) as Product).filter(Boolean) : []);
    setDrafts(Object.fromEntries(nextUsers.map((user) => [user.id, user.productIds])));
    setHealthOk(Boolean(healthResult));
    setNotice(options.notice || '');
    setError(usersResult.error || productsResult.error ? 'Some admin data could not be loaded.' : '');
  }

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createForm.email.includes('@')) {
      setError('Valid email required.');
      return;
    }
    setBusyAction('create-user');
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
      await reload({ notice: `Created ${result.email}. Temporary password: ${result.temp_password}` });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyAction('');
    }
  }

  async function updateProducts(user: AdminUser) {
    setBusyAction(`products:${user.id}`);
    try {
      await adminApi('update-products', { user_id: user.id, product_ids: drafts[user.id] || [] });
      await reload({ notice: `Updated product access for ${user.email}.` });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyAction('');
    }
  }

  async function setRole(user: AdminUser) {
    const nextRole = user.role === 'admin' ? 'member' : 'admin';
    if (!window.confirm(`${nextRole === 'admin' ? 'Promote' : 'Demote'} ${user.email}?`)) return;
    setBusyAction(`role:${user.id}`);
    try {
      await adminApi('set-role', { user_id: user.id, role: nextRole });
      await reload({ notice: `${user.email} is now ${nextRole}.` });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyAction('');
    }
  }

  async function resetPassword(user: AdminUser) {
    if (!window.confirm(`Reset password for ${user.email}?`)) return;
    setBusyAction(`reset:${user.id}`);
    try {
      const result = await adminApi('reset-password', { user_id: user.id });
      await reload({ notice: `Temporary password for ${user.email}: ${result.temp_password}` });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyAction('');
    }
  }

  async function setActive(user: AdminUser, active: boolean) {
    if (!active && !window.confirm(`Deactivate ${user.email}?`)) return;
    setBusyAction(`active:${user.id}`);
    try {
      await adminApi(active ? 'reactivate' : 'deactivate', { user_id: user.id });
      await reload({ notice: `${user.email} ${active ? 'reactivated' : 'deactivated'}.` });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyAction('');
    }
  }

  function setDraftProduct(userId: string, productId: string) {
    setDrafts((current) => ({ ...current, [userId]: toggleProductAssignment(current[userId] || [], productId) }));
  }

  function setCreateProduct(productId: string) {
    setCreateForm((current) => ({ ...current, productIds: toggleProductAssignment(current.productIds, productId) }));
  }

  const productNameById = Object.fromEntries(products.map((product) => [product.id, product.name || product.id]));

  return (
    <>
      <section className={styles.adminToolbar}>
        <div><strong>{users.length}</strong><span>Users</span></div>
        <div><strong>{products.length}</strong><span>Products</span></div>
        <div className={healthOk ? styles.healthOk : styles.healthBad}><strong>{healthOk ? 'Ready' : 'Offline'}</strong><span>Admin API</span></div>
        <button type="button" onClick={() => reload()}>Refresh</button>
      </section>
      {notice ? <div className={styles.notice}>{notice}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}
      <section className={styles.adminGrid}>
        <form className={styles.adminCreate} onSubmit={createUser}>
          <div><span className={styles.eyebrow}>Admin</span><h2>New teammate</h2></div>
          <label><span>Email</span><input autoComplete="off" type="email" value={createForm.email} onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })} required /></label>
          <label><span>Username</span><input autoComplete="off" value={createForm.username} onChange={(event) => setCreateForm({ ...createForm, username: event.target.value })} /></label>
          <label><span>Full Name</span><input autoComplete="off" value={createForm.fullName} onChange={(event) => setCreateForm({ ...createForm, fullName: event.target.value })} /></label>
          <label>
            <span>Role</span>
            <select value={createForm.role} onChange={(event) => setCreateForm({ ...createForm, role: event.target.value as CreateUserForm['role'] })}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label><span>Temporary Password</span><input autoComplete="new-password" type="text" value={createForm.tempPassword} onChange={(event) => setCreateForm({ ...createForm, tempPassword: event.target.value })} placeholder="Leave blank to generate" /></label>
          {createForm.role === 'member' ? (
            <fieldset className={styles.productChecks}>
              <legend>Product Access</legend>
              {products.map((product) => (
                <label key={product.id}>
                  <input checked={createForm.productIds.includes(product.id)} type="checkbox" onChange={() => setCreateProduct(product.id)} />
                  <span>{product.name || product.id}</span>
                </label>
              ))}
            </fieldset>
          ) : null}
          <button disabled={busyAction === 'create-user'} type="submit">{busyAction === 'create-user' ? 'Creating...' : 'Create user'}</button>
        </form>
        <section className={styles.adminUsers}>
          <div className={styles.adminSectionHeader}><div><span className={styles.eyebrow}>Admin</span><h2>Users</h2></div></div>
          <div className={styles.userRows}>
            {users.map((user) => (
              <article className={styles.userRow} key={user.id}>
                <div className={styles.userIdentity}><strong>{user.email}</strong><span>{user.fullName || user.username || 'No profile name'}</span></div>
                <div className={styles.statusStack}>
                  <span className={user.role === 'admin' ? styles.roleAdmin : styles.roleMember}>{user.role}</span>
                  <span className={user.isActive ? styles.activeBadge : styles.inactiveBadge}>{user.isActive ? 'Active' : 'Inactive'}</span>
                  {user.mustChangePassword ? <span className={styles.pendingBadge}>Password reset</span> : null}
                </div>
                <div className={styles.assignmentSummary}>{productAssignmentLabel(user, productNameById)}</div>
                {user.role === 'member' ? (
                  <fieldset className={styles.inlineProducts}>
                    <legend>Assigned products</legend>
                    {products.map((product) => (
                      <label key={product.id}>
                        <input checked={(drafts[user.id] || []).includes(product.id)} type="checkbox" onChange={() => setDraftProduct(user.id, product.id)} />
                        <span>{product.name || product.id}</span>
                      </label>
                    ))}
                    <button disabled={busyAction === `products:${user.id}`} type="button" onClick={() => updateProducts(user)}>{busyAction === `products:${user.id}` ? 'Saving...' : 'Save access'}</button>
                  </fieldset>
                ) : null}
                <div className={styles.rowActions}>
                  <button disabled={busyAction === `reset:${user.id}`} type="button" onClick={() => resetPassword(user)}>Reset password</button>
                  <button disabled={busyAction === `role:${user.id}`} type="button" onClick={() => setRole(user)}>{user.role === 'admin' ? 'Make member' : 'Make admin'}</button>
                  <button disabled={busyAction === `active:${user.id}`} type="button" onClick={() => setActive(user, !user.isActive)}>{user.isActive ? 'Deactivate' : 'Reactivate'}</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </>
  );
}

async function hydrateSession(supabase: SupabaseClient, setState: React.Dispatch<React.SetStateAction<AppState>>) {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    setState({ view: 'login' });
    return;
  }

  await loadAuthedState(supabase, session.data.session, setState);
}

async function loadAuthedState(supabase: SupabaseClient, session: Session, setState: React.Dispatch<React.SetStateAction<AppState>>) {
  const [profileResult, userProductsResult, productsResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', session.user.id).single(),
    supabase.from('user_products').select('product_id').eq('user_id', session.user.id),
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
    setState({ view: 'password', session, user: session.user, profile });
    return;
  }

  const allProducts = Array.isArray(productsResult.data) ? productsResult.data.map((row) => productRowToView(row) as Product).filter(Boolean) : [];
  const assignedProductIds = profile.role === 'admin' ? null : normalizeProductIds(userProductsResult.data || []);
  const products = resolveAccessibleProducts(profile, assignedProductIds || [], allProducts) as Product[];
  const savedProductId = typeof window !== 'undefined' ? window.localStorage.getItem(ACTIVE_PRODUCT_KEY) || '' : '';
  const activeProductId = resolveActiveProductId(savedProductId, products);
  if (activeProductId) window.localStorage.setItem(ACTIVE_PRODUCT_KEY, activeProductId);
  const savedTab = typeof window !== 'undefined' ? window.localStorage.getItem(ACTIVE_TAB_KEY) as ActiveTab | null : null;
  const activeTab = validTabForProfile(savedTab, profile) ? savedTab : 'overview';

  setState({
    view: 'dashboard',
    session,
    user: session.user,
    profile,
    products,
    activeProductId,
    activeTab,
    error: productsResult.error ? 'Products could not be fully loaded.' : undefined,
  });
}

function commandTabs(profile: Profile) {
  const tabs: Array<{ id: ActiveTab; label: string; caption: string }> = [
    { id: 'overview', label: 'Overview', caption: 'Product access' },
    { id: 'angles', label: 'Angles', caption: 'Strategy axes' },
    { id: 'personas', label: 'Personas', caption: 'Audience axes' },
    { id: 'creative-tracker', label: 'Creative Tracker', caption: 'Ad inventory' },
    { id: 'action-plan', label: 'Action Plan', caption: 'Manual actions' },
    { id: 'inspiration', label: 'Inspiration Queue', caption: 'Worker health' },
  ];
  if (profile.role === 'admin') tabs.push({ id: 'admin', label: 'Admin', caption: 'Users' });
  return tabs;
}

function validTabForProfile(tab: ActiveTab | null, profile: Profile): tab is ActiveTab {
  if (!tab) return false;
  if (tab === 'admin' && profile.role !== 'admin') return false;
  return ['overview', 'angles', 'personas', 'action-plan', 'creative-tracker', 'inspiration', 'admin'].includes(tab);
}

function taxonomyTable(kind: TaxonomyKind) {
  return kind === 'angle' ? 'angles' : 'personas';
}

function taxonomyColumn(kind: TaxonomyKind) {
  return kind === 'angle' ? 'angle' : 'persona';
}

function taxonomyLabel(kind: TaxonomyKind) {
  return kind === 'angle' ? 'Angle' : 'Persona';
}

function nextTaxonomyName(baseName: string, rows: TaxonomyRow[]) {
  const existing = new Set(rows.map((row) => row.name.toLowerCase()));
  if (!existing.has(baseName.toLowerCase())) return baseName;
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${baseName} ${index}`;
    if (!existing.has(candidate.toLowerCase())) return candidate;
  }
  return `${baseName} ${Date.now().toString(36)}`;
}

function FilterSelect({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{label}</option>
      {values.map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
  );
}

function filterJobs(jobs: QueueJob[], filter: QueueFilter) {
  if (filter === 'all') return jobs;
  if (filter === 'active') return jobs.filter((job) => ['claimed', 'classifying', 'processing'].includes(job.status));
  if (filter === 'classified') return jobs.filter((job) => ['classified', 'done'].includes(job.status));
  if (filter === 'failed') return jobs.filter((job) => ['failed', 'error'].includes(job.status));
  return jobs.filter((job) => job.status === filter);
}

function actionStatusClass(status: string, css: typeof styles) {
  const bucket = actionPlanBucket(status);
  if (bucket === 'winners') return css.activeBadge;
  if (bucket === 'losers') return css.inactiveBadge;
  if (bucket === 'production' || bucket === 'testing') return css.roleMember;
  return css.pendingBadge;
}

function creativeStatusClass(status: string, css: typeof styles) {
  const bucket = creativeStatusBucket(status);
  if (bucket === 'winner') return css.activeBadge;
  if (bucket === 'loser') return css.inactiveBadge;
  if (bucket === 'testing' || bucket === 'ready') return css.roleMember;
  return css.pendingBadge;
}

function queueStatusClass(status: string, css: typeof styles) {
  if (status === 'pending') return css.pendingBadge;
  if (['claimed', 'classifying', 'processing'].includes(status)) return css.roleMember;
  if (['classified', 'done'].includes(status)) return css.activeBadge;
  if (['failed', 'error'].includes(status)) return css.inactiveBadge;
  return css.pendingBadge;
}

function workerHealthClass(health: string, css: typeof styles) {
  if (['online', 'busy'].includes(health)) return css.activeBadge;
  if (health === 'paused') return css.pendingBadge;
  return css.inactiveBadge;
}

function sortMark(sort: TrackerSort, col: TrackerSortColumn) {
  if (sort.col !== col) return '';
  return sort.dir === 1 ? 'asc' : 'desc';
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

function formatDate(value: string | number | null | undefined) {
  const dateMs = timestampMs(value);
  if (!dateMs) return '-';
  return new Date(dateMs).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatAge(ageMs: number | null) {
  if (ageMs === null) return 'unknown';
  const minutes = Math.floor(ageMs / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

function capabilityText(capabilities: Record<string, unknown>, key: string) {
  const value = capabilities[key];
  if (value === undefined || value === null || value === '') return '';
  return String(value);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Action failed.';
}
