import styles from '../../command-center.module.css';
import { formatDateTime } from '../helpers/format';
import { useCompetitors } from '../hooks/use-competitors';
import type { CompetitorForm } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';

export function CompetitorsTab({ supabase, activeProductId, userId }: { supabase: SupabaseClient; activeProductId: string; userId: string }) {
  const {
    brands,
    approvedCount,
    activeJobs,
    busyAction,
    reload,
    setShowForm,
    showForm,
    enqueue,
    notice,
    error,
    directCount,
    indirectCount,
    similarCount,
    pendingCount,
    loadedAt,
    view,
    setView,
    saveBrand,
    form,
    setForm,
    buckets,
    creatives,
    jobs,
    toggleApproved,
    deleteBrand,
  } = useCompetitors({ supabase, activeProductId, userId });

  return (
    <>
      <section className={`${styles.adminToolbar} ${styles.competitorToolbar}`}>
        <div><strong>{brands.length}</strong><span>Total brands</span></div>
        <div><strong>{approvedCount}</strong><span>Approved</span></div>
        <div className={activeJobs.length ? styles.healthBad : styles.healthOk}><strong>{activeJobs.length}</strong><span>Active jobs</span></div>
        <button disabled={busyAction === 'reload'} type="button" onClick={() => reload()}>{busyAction === 'reload' ? 'Refreshing...' : 'Refresh'}</button>
        <button type="button" onClick={() => setShowForm((current) => !current)}>{showForm ? 'Close form' : 'Add brand'}</button>
        <button disabled={busyAction.startsWith('queue:discover_brands')} type="button" onClick={() => enqueue('discover_brands')}>Run discovery</button>
        <button disabled={!approvedCount || busyAction.startsWith('queue:generate_recommendations')} type="button" onClick={() => enqueue('generate_recommendations')}>Generate recommendations</button>
      </section>
      {notice ? <div className={styles.notice}>{notice}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}
      <section className={styles.productBar}>
        <div className={styles.queueMeta}>
          <span>{directCount} direct</span>
          <span>{indirectCount} indirect</span>
          <span>{similarCount} similar niche</span>
          <span>{pendingCount} pending review</span>
          <span>Loaded {formatDateTime(loadedAt)}</span>
        </div>
        <div className={styles.segmented}>
          <button className={view === 'approved' ? styles.segmentActive : ''} type="button" onClick={() => setView('approved')}>Approved</button>
          <button className={view === 'pending' ? styles.segmentActive : ''} type="button" onClick={() => setView('pending')}>Pending</button>
          <button className={view === 'all' ? styles.segmentActive : ''} type="button" onClick={() => setView('all')}>All</button>
        </div>
      </section>
      {showForm ? (
        <form className={styles.competitorForm} onSubmit={saveBrand}>
          <label><span>Brand name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
          <label>
            <span>Category</span>
            <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as CompetitorForm['category'] })}>
              <option value="direct">Direct</option>
              <option value="indirect">Indirect</option>
              <option value="similar_niche">Similar niche</option>
            </select>
          </label>
          <label><span>Meta Page ID</span><input value={form.metaPageId} onChange={(event) => setForm({ ...form, metaPageId: event.target.value })} /></label>
          <label><span>Homepage URL</span><input value={form.homepageUrl} onChange={(event) => setForm({ ...form, homepageUrl: event.target.value })} /></label>
          <label className={styles.formWide}><span>Notes</span><textarea rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
          <button disabled={busyAction === 'save-brand'} type="submit">{busyAction === 'save-brand' ? 'Saving...' : 'Save brand'}</button>
        </form>
      ) : null}
      {activeJobs.length ? (
        <section className={styles.liveActivity}>
          <div><span className={styles.eyebrow}>Live Activity</span><h2>{activeJobs.length} running or queued</h2></div>
          <div className={styles.activityChips}>
            {activeJobs.slice(0, 12).map((job) => (
              <span key={job.id}>{job.jobType.replaceAll('_', ' ')} · {job.status}</span>
            ))}
          </div>
        </section>
      ) : null}
      <section className={styles.competitorBuckets}>
        {buckets.map((bucket) => (
          <article className={styles.competitorBucket} key={bucket.id}>
            <header><div><strong>{bucket.title}</strong><span>{bucket.subtitle}</span></div><em>{bucket.rows.length}</em></header>
            <div className={styles.competitorCards}>
              {bucket.rows.length ? bucket.rows.map((brand) => {
                const brandCreatives = creatives.filter((creative) => creative.brandId === brand.id);
                const job = jobs.find((candidate) => candidate.brandId === brand.id && candidate.jobType === 'find_creatives_for_brand');
                return (
                  <article className={brand.approved ? styles.competitorCardApproved : styles.competitorCard} key={brand.id}>
                    <div className={styles.competitorCardHead}>
                      <div><strong>{brand.name}</strong><span>{brand.activeAdCount ?? 'No'} active ads</span></div>
                      <button disabled={busyAction === `approve:${brand.id}`} type="button" onClick={() => toggleApproved(brand)}>{brand.approved ? 'Approved' : 'Approve'}</button>
                    </div>
                    <dl>
                      <div><dt>Seen</dt><dd>{formatDateTime(brand.lastSeenAt) || '-'}</dd></div>
                      <div><dt>Research</dt><dd>{job?.status || 'not queued'}</dd></div>
                      <div><dt>Creatives</dt><dd>{brandCreatives.length}</dd></div>
                    </dl>
                    {brand.notes ? <p>{brand.notes}</p> : null}
                    {brandCreatives.length ? (
                      <ul>
                        {brandCreatives.slice(0, 3).map((creative) => (
                          <li key={creative.id}>
                            <span>{creative.hook || creative.angle || creative.id}</span>
                            <small>{creative.statusLabel || creative.persona || 'creative'}</small>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className={styles.actionLinks}>
                      {brand.metaAdLibraryUrl ? <a href={brand.metaAdLibraryUrl} target="_blank" rel="noreferrer">Meta Library</a> : null}
                      {brand.homepageUrl ? <a href={brand.homepageUrl} target="_blank" rel="noreferrer">Site</a> : null}
                      <button disabled={!brand.approved || busyAction === `queue:find_creatives_for_brand:${brand.id}`} type="button" onClick={() => enqueue('find_creatives_for_brand', brand)}>Find creatives</button>
                      <button disabled={busyAction === `delete:${brand.id}`} type="button" onClick={() => deleteBrand(brand)}>Delete</button>
                    </div>
                  </article>
                );
              }) : <div className={styles.emptyState}>No brands in this bucket.</div>}
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
