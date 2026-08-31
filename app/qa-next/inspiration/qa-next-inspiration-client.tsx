'use client';

import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';

import {
  normalizeProductIds,
  resolveAccessibleProducts,
  resolveActiveProductId,
} from '../../../lib/domain/auth-access.js';
import {
  isClaimStale,
  normalizeQueueJob,
  normalizeWorker,
  summarizeQueue,
} from '../../../lib/domain/worker-queue.js';
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

type QueueJob = ReturnType<typeof normalizeQueueJob>;
type WorkerRow = ReturnType<typeof normalizeWorker>;
type QueueFilter = 'all' | 'pending' | 'active' | 'classified' | 'failed';

type QueueState =
  | { view: 'checking' }
  | { view: 'signed-out'; error?: string }
  | { view: 'password-required'; email: string }
  | {
      view: 'queue';
      session: Session;
      profile: Profile;
      products: Product[];
      activeProductId: string;
      jobs: QueueJob[];
      workers: WorkerRow[];
      filter: QueueFilter;
      loadedAt: string;
      error?: string;
    };

type QaNextInspirationClientProps = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

const ACTIVE_PRODUCT_KEY = 'immuvi_active_product';

export default function QaNextInspirationClient({ supabaseUrl, supabaseAnonKey }: QaNextInspirationClientProps) {
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
  const [state, setState] = useState<QueueState>({ view: 'checking' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadQueueState(supabase, setState);
  }, [supabase]);

  async function reload(productId?: string) {
    setBusy(true);
    await loadQueueState(supabase, setState, productId);
    setBusy(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setState({ view: 'signed-out' });
  }

  function setFilter(filter: QueueFilter) {
    setState((current) => current.view === 'queue' ? { ...current, filter } : current);
  }

  function switchProduct(productId: string) {
    window.localStorage.setItem(ACTIVE_PRODUCT_KEY, productId);
    void reload(productId);
  }

  if (state.view === 'checking') {
    return (
      <main className={styles.shell}>
        <section className={styles.authCard}>
          <h1>Inspiration Queue</h1>
          <p>Checking session...</p>
        </section>
      </main>
    );
  }

  if (state.view === 'signed-out') {
    return (
      <main className={styles.shell}>
        <section className={styles.authCard}>
          <h1>Inspiration Queue</h1>
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
          <p>{state.email} must finish the password-change gate before using queue tools.</p>
          <a className={styles.primaryLink} href="/qa-next">Open QA Next</a>
        </section>
      </main>
    );
  }

  const activeProduct = state.products.find((product) => product.id === state.activeProductId) || state.products[0];
  const summary = summarizeQueue(state.jobs);
  const filteredJobs = filterJobs(state.jobs, state.filter);
  const healthyWorkers = state.workers.filter((worker) => ['online', 'busy'].includes(worker.health)).length;

  return (
    <main className={styles.dashboard}>
      <header className={styles.topbar}>
        <div>
          <span className={styles.eyebrow}>QA Next</span>
          <h1>Inspiration Queue</h1>
        </div>
        <div className={styles.userPill}>
          <span>{state.profile.username || state.profile.email}</span>
          <strong>{state.profile.role}</strong>
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <section className={styles.adminToolbar}>
        <div>
          <strong>{summary.pending}</strong>
          <span>Pending</span>
        </div>
        <div>
          <strong>{summary.active}</strong>
          <span>Active</span>
        </div>
        <div className={summary.failed ? styles.healthBad : styles.healthOk}>
          <strong>{summary.failed}</strong>
          <span>Failed</span>
        </div>
        <a href="/qa-next">Product switcher</a>
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
          <span>Loaded {formatDateTime(state.loadedAt)}</span>
        </div>
      </section>

      <section className={styles.queueGrid}>
        <section className={styles.queueMain}>
          <div className={styles.adminSectionHeader}>
            <div>
              <span className={styles.eyebrow}>Jobs</span>
              <h2>Recent queue rows</h2>
            </div>
            <select
              className={styles.filterSelect}
              value={state.filter}
              onChange={(event) => setFilter(event.target.value as QueueFilter)}
            >
              <option value="all">All rows</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="classified">Classified</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className={styles.queueRows}>
            {filteredJobs.length ? filteredJobs.map((job) => (
              <article className={styles.queueRow} key={job.id}>
                <div className={styles.jobTitle}>
                  <strong>{job.insId || job.id}</strong>
                  <a href={job.url} target="_blank" rel="noreferrer">{job.platform || 'source'}</a>
                </div>
                <div className={styles.statusStack}>
                  <span className={statusClass(job.status, styles)}>{job.status}</span>
                  {isClaimStale(job) ? <span className={styles.inactiveBadge}>Stale claim</span> : null}
                  {job.workerAssignment !== 'auto' ? <span className={styles.pendingBadge}>{job.workerAssignment}</span> : null}
                </div>
                <dl className={styles.queueFacts}>
                  <div>
                    <dt>Queued</dt>
                    <dd>{formatDateTime(job.queuedAt)}</dd>
                  </div>
                  <div>
                    <dt>Claimed</dt>
                    <dd>{job.claimedBy || '-'}</dd>
                  </div>
                  <div>
                    <dt>Attempts</dt>
                    <dd>{job.attempts}</dd>
                  </div>
                  <div>
                    <dt>Processed</dt>
                    <dd>{formatDateTime(job.processedAt) || '-'}</dd>
                  </div>
                </dl>
                {job.errorMessage ? <p className={styles.queueError}>{job.errorMessage}</p> : null}
              </article>
            )) : (
              <div className={styles.emptyState}>No queue rows match this filter.</div>
            )}
          </div>
        </section>

        <aside className={styles.workerPanel}>
          <div>
            <span className={styles.eyebrow}>Workers</span>
            <h2>{healthyWorkers}/{state.workers.length} healthy</h2>
          </div>
          <div className={styles.workerRows}>
            {state.workers.length ? state.workers.map((worker) => (
              <article className={styles.workerRow} key={worker.workerId}>
                <div>
                  <strong>{worker.workerId}</strong>
                  <span>{worker.hostname || worker.os || 'unknown host'}</span>
                </div>
                <span className={workerHealthClass(worker.health, styles)}>{worker.health}</span>
                <dl>
                  <div>
                    <dt>Heartbeat</dt>
                    <dd>{formatAge(worker.heartbeatAgeMs)}</dd>
                  </div>
                  <div>
                    <dt>Last Job</dt>
                    <dd>{formatDateTime(worker.lastJobAt) || '-'}</dd>
                  </div>
                  <div>
                    <dt>Done / Failed</dt>
                    <dd>{worker.jobsCompletedTotal} / {worker.jobsFailedTotal}</dd>
                  </div>
                  <div>
                    <dt>Contract</dt>
                    <dd>{capabilityText(worker.capabilities, 'worker_contract') || '-'}</dd>
                  </div>
                </dl>
              </article>
            )) : (
              <div className={styles.emptyState}>No workers registered in QA yet.</div>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

async function loadQueueState(
  supabase: SupabaseClient,
  setState: React.Dispatch<React.SetStateAction<QueueState>>,
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

  const [queueResult, workersResult] = await Promise.all([
    activeProductId
      ? supabase
          .from('inspiration_queue')
          .select('id,ins_id,product_id,url,platform,status,error_message,queued_at,processed_at,claimed_by,claimed_at,worker_assignment,attempts')
          .eq('product_id', activeProductId)
          .order('queued_at', { ascending: false })
          .limit(80)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('worker_registry')
      .select('worker_id,hostname,os,python_version,claude_code_version,last_heartbeat,last_job_at,jobs_completed_total,jobs_failed_total,status,current_job_id,capabilities,enabled,created_at')
      .order('last_heartbeat', { ascending: false }),
  ]);

  setState({
    view: 'queue',
    session,
    profile,
    products,
    activeProductId,
    jobs: Array.isArray(queueResult.data) ? queueResult.data.map(normalizeQueueJob) : [],
    workers: Array.isArray(workersResult.data) ? workersResult.data.map((row) => normalizeWorker(row)) : [],
    filter: 'all',
    loadedAt: new Date().toISOString(),
    error: productsResult.error || queueResult.error || workersResult.error
      ? 'Some queue data could not be loaded.'
      : undefined,
  });
}

function filterJobs(jobs: QueueJob[], filter: QueueFilter) {
  if (filter === 'all') return jobs;
  if (filter === 'active') return jobs.filter((job) => ['claimed', 'classifying', 'processing'].includes(job.status));
  if (filter === 'classified') return jobs.filter((job) => ['classified', 'done'].includes(job.status));
  if (filter === 'failed') return jobs.filter((job) => ['failed', 'error'].includes(job.status));
  return jobs.filter((job) => job.status === filter);
}

function statusClass(status: string, css: typeof styles) {
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

function formatDateTime(value: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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
