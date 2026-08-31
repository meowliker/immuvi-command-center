'use client';

import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';

import {
  creativeFilterOptions,
  creativeStatusBucket,
  filterCreativeTrackerRows,
  normalizeCreativeRow,
  sortCreativeTrackerRows,
  summarizeCreativeTracker,
  usageCountForCreative,
  variationCountForCreative,
} from '../../../lib/domain/creative-tracker.js';
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

type Creative = ReturnType<typeof normalizeCreativeRow>;
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

type CreativeTrackerState =
  | { view: 'checking' }
  | { view: 'signed-out'; error?: string }
  | { view: 'password-required'; email: string }
  | {
      view: 'tracker';
      session: Session;
      profile: Profile;
      products: Product[];
      activeProductId: string;
      creatives: Creative[];
      matrixCells: MatrixCell[];
      filters: TrackerFilters;
      sort: TrackerSort;
      loadedAt: string;
      error?: string;
    };

type QaNextCreativeTrackerClientProps = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

const ACTIVE_PRODUCT_KEY = 'immuvi_active_product';
const defaultFilters: TrackerFilters = {
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

export default function QaNextCreativeTrackerClient({ supabaseUrl, supabaseAnonKey }: QaNextCreativeTrackerClientProps) {
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
  const [state, setState] = useState<CreativeTrackerState>({ view: 'checking' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadCreativeTrackerState(supabase, setState);
  }, [supabase]);

  async function reload(productId?: string) {
    setBusy(true);
    await loadCreativeTrackerState(supabase, setState, productId);
    setBusy(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setState({ view: 'signed-out' });
  }

  function switchProduct(productId: string) {
    window.localStorage.setItem(ACTIVE_PRODUCT_KEY, productId);
    void reload(productId);
  }

  function setFilter<K extends keyof TrackerFilters>(key: K, value: TrackerFilters[K]) {
    setState((current) => current.view === 'tracker'
      ? { ...current, filters: { ...current.filters, [key]: value } }
      : current);
  }

  function setTaskType(taskType: TrackerFilters['taskType']) {
    setFilter('taskType', taskType);
  }

  function clearFilters() {
    setState((current) => current.view === 'tracker' ? { ...current, filters: { ...defaultFilters } } : current);
  }

  function setSort(col: TrackerSort['col']) {
    setState((current) => {
      if (current.view !== 'tracker') return current;
      const dir = current.sort.col === col && current.sort.dir === 1 ? -1 : 1;
      return { ...current, sort: { col, dir } };
    });
  }

  if (state.view === 'checking') {
    return (
      <main className={styles.shell}>
        <section className={styles.authCard}>
          <h1>Creative Tracker</h1>
          <p>Checking session...</p>
        </section>
      </main>
    );
  }

  if (state.view === 'signed-out') {
    return (
      <main className={styles.shell}>
        <section className={styles.authCard}>
          <h1>Creative Tracker</h1>
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
          <p>{state.email} must finish the password-change gate before using Creative Tracker.</p>
          <a className={styles.primaryLink} href="/qa-next">Open QA Next</a>
        </section>
      </main>
    );
  }

  const activeProduct = state.products.find((product) => product.id === state.activeProductId) || state.products[0];
  const summary = summarizeCreativeTracker(state.creatives);
  const options = creativeFilterOptions(state.creatives);
  const filtered = sortCreativeTrackerRows(
    filterCreativeTrackerRows(state.creatives, state.filters),
    state.sort,
  );

  return (
    <main className={styles.dashboard}>
      <header className={styles.topbar}>
        <div>
          <span className={styles.eyebrow}>QA Next</span>
          <h1>Creative Tracker</h1>
        </div>
        <div className={styles.userPill}>
          <span>{state.profile.username || state.profile.email}</span>
          <strong>{state.profile.role}</strong>
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <section className={styles.adminToolbar}>
        <div>
          <strong>{summary.total}</strong>
          <span>Creatives</span>
        </div>
        <div>
          <strong>{summary.production}</strong>
          <span>Production</span>
        </div>
        <div className={summary.missingLinks ? styles.healthBad : styles.healthOk}>
          <strong>{summary.missingLinks}</strong>
          <span>Missing links</span>
        </div>
        <a href="/qa-next">Product switcher</a>
        <a href="/qa-next/action-plan">Action Plan</a>
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
          <span>{filtered.length} shown</span>
          <span>Loaded {formatDateTime(state.loadedAt)}</span>
        </div>
      </section>

      <section className={styles.trackerFilters}>
        <div className={styles.segmented}>
          <button className={state.filters.taskType === '' ? styles.segmentActive : ''} type="button" onClick={() => setTaskType('')}>All</button>
          <button className={state.filters.taskType === 'format' ? styles.segmentActive : ''} type="button" onClick={() => setTaskType('format')}>Formats</button>
          <button className={state.filters.taskType === 'production' ? styles.segmentActive : ''} type="button" onClick={() => setTaskType('production')}>Production</button>
        </div>
        <select value={state.filters.angle} onChange={(event) => setFilter('angle', event.target.value)}>
          <option value="">All angles</option>
          {options.angles.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={state.filters.persona} onChange={(event) => setFilter('persona', event.target.value)}>
          <option value="">All personas</option>
          {options.personas.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={state.filters.format} onChange={(event) => setFilter('format', event.target.value)}>
          <option value="">All formats</option>
          {options.formats.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={state.filters.structure} onChange={(event) => setFilter('structure', event.target.value)}>
          <option value="">All structures</option>
          {options.structures.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={state.filters.hookType} onChange={(event) => setFilter('hookType', event.target.value)}>
          <option value="">All hooks</option>
          {options.hookTypes.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={state.filters.productionStyle} onChange={(event) => setFilter('productionStyle', event.target.value)}>
          <option value="">All production</option>
          {options.productionStyles.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={state.filters.adType} onChange={(event) => setFilter('adType', event.target.value)}>
          <option value="">All ad types</option>
          {options.adTypes.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={state.filters.funnelStage} onChange={(event) => setFilter('funnelStage', event.target.value)}>
          <option value="">All funnels</option>
          {options.funnelStages.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={state.filters.status} onChange={(event) => setFilter('status', event.target.value)}>
          <option value="">All statuses</option>
          {options.statuses.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={state.filters.dateRange} onChange={(event) => setFilter('dateRange', event.target.value as TrackerFilters['dateRange'])}>
          <option value="">All time</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
        <button type="button" onClick={clearFilters}>Clear</button>
      </section>

      <section className={styles.creativeTrackerGrid}>
        <section className={styles.queueMain}>
          <div className={styles.adminSectionHeader}>
            <div>
              <span className={styles.eyebrow}>Rows</span>
              <h2>Creative inventory</h2>
            </div>
            <div className={styles.sortButtons}>
              <button type="button" onClick={() => setSort('formatName')}>Name {sortMark(state.sort, 'formatName')}</button>
              <button type="button" onClick={() => setSort('status')}>Status {sortMark(state.sort, 'status')}</button>
              <button type="button" onClick={() => setSort('dateCreated')}>Created {sortMark(state.sort, 'dateCreated')}</button>
            </div>
          </div>

          <div className={styles.creativeRows}>
            {filtered.length ? filtered.map((creative) => (
              <article className={creative.taskType === 'production' ? styles.productionCreativeRow : styles.creativeRow} key={creative.id}>
                <div className={styles.creativeTitle}>
                  <div>
                    <strong>{creative.formatName || creative.id}</strong>
                    <span>{[creative.angle, creative.persona].filter(Boolean).join(' x ') || 'No matrix cell'}</span>
                  </div>
                  <span className={creativeStatusClass(creative.status, styles)}>{creative.status}</span>
                </div>
                <dl className={styles.creativeFacts}>
                  <div><dt>Structure</dt><dd>{creative.creativeStructure || '-'}</dd></div>
                  <div><dt>Hook</dt><dd>{creative.hookType || '-'}</dd></div>
                  <div><dt>Production</dt><dd>{creative.productionStyle || '-'}</dd></div>
                  <div><dt>Type</dt><dd>{creative.adType || '-'}</dd></div>
                  <div><dt>Funnel</dt><dd>{creative.funnelStage || '-'}</dd></div>
                  <div><dt>Created</dt><dd>{formatDate(creative.dateCreated)}</dd></div>
                  <div><dt>Variations</dt><dd>{variationCountForCreative(creative, state.creatives)}</dd></div>
                  <div><dt>Usage</dt><dd>{creative.taskType === 'production' ? '1 cell' : usageCountForCreative(creative, state.creatives, state.matrixCells)}</dd></div>
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
            )) : (
              <div className={styles.emptyState}>No creatives match your filters.</div>
            )}
          </div>
        </section>

        <aside className={styles.workerPanel}>
          <div>
            <span className={styles.eyebrow}>Summary</span>
            <h2>{summary.total} visible rows</h2>
          </div>
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
    </main>
  );
}

async function loadCreativeTrackerState(
  supabase: SupabaseClient,
  setState: React.Dispatch<React.SetStateAction<CreativeTrackerState>>,
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

  const [adsResult, matrixCellsResult] = await Promise.all([
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
          .from('matrix_cells')
          .select('id,angle_id,persona_id,creative_assignments')
          .eq('product_id', activeProductId)
          .limit(3000)
      : Promise.resolve({ data: [], error: null }),
  ]);

  setState({
    view: 'tracker',
    session,
    profile,
    products,
    activeProductId,
    creatives: Array.isArray(adsResult.data) ? adsResult.data.map(normalizeCreativeRow) : [],
    matrixCells: Array.isArray(matrixCellsResult.data) ? matrixCellsResult.data as MatrixCell[] : [],
    filters: { ...defaultFilters },
    sort: { col: 'id', dir: 1 },
    loadedAt: new Date().toISOString(),
    error: productsResult.error || adsResult.error || matrixCellsResult.error
      ? 'Some Creative Tracker data could not be loaded.'
      : undefined,
  });
}

function creativeStatusClass(status: string, css: typeof styles) {
  const bucket = creativeStatusBucket(status);
  if (bucket === 'winner') return css.activeBadge;
  if (bucket === 'loser') return css.inactiveBadge;
  if (bucket === 'testing' || bucket === 'ready') return css.roleMember;
  return css.pendingBadge;
}

function sortMark(sort: TrackerSort, col: TrackerSort['col']) {
  if (sort.col !== col) return '';
  return sort.dir === 1 ? 'asc' : 'desc';
}

function formatDateTime(value: string | number | null | undefined) {
  const dateMs = typeof value === 'number' ? value : Date.parse(String(value || ''));
  if (!Number.isFinite(dateMs)) return '';
  return new Date(dateMs).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(value: string | number | null | undefined) {
  const dateMs = typeof value === 'number' ? value : Date.parse(String(value || ''));
  if (!Number.isFinite(dateMs)) return '-';
  return new Date(dateMs).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
