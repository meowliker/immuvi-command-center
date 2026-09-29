import styles from '../../command-center.module.css';
import { MarkdownLite, StrategistStructured } from '../components/strategist-memory';
import { SharedAnalysisControl } from '../components/shared-analysis-control';
import { isLikelyClickUpTaskId } from '../helpers/creatives';
import { formatDateTime } from '../helpers/format';
import { useStrategist } from '../hooks/use-strategist';
import type { Product } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';

export function StrategistTab({
  supabase,
  activeProductId,
  activeProduct,
  userId,
}: {
  supabase: SupabaseClient;
  activeProductId: string;
  activeProduct?: Product;
  userId: string;
}) {
  const {
    stats,
    run,
    busyAction,
    reload,
    notice,
    error,
    memory,
    loadedAt,
    memoryView,
    setMemoryView,
    filtered,
    view,
    setView,
    approveAndTest,
    updateRecommendation,
  } = useStrategist({
  supabase,
  activeProductId,
  activeProduct,
  userId,
});

  return (
    <>
      <section className={styles.adminToolbar}>
        <div><strong>{String(stats.winner ?? 0)}</strong><span>Winners</span></div>
        <div><strong>{String(stats.scale ?? 0)}</strong><span>Scaled</span></div>
        <div className={run?.status === 'failed' ? styles.healthBad : styles.healthOk}><strong>{run?.status || 'No run'}</strong><span>Latest run</span></div>
        <button disabled={busyAction === 'reload'} type="button" onClick={() => reload()}>{busyAction === 'reload' ? 'Refreshing...' : 'Refresh'}</button>
        <SharedAnalysisControl key={activeProductId} db={supabase} productId={activeProductId} kind="strategist" />
      </section>
      {notice ? <div className={styles.notice}>{notice}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}
      <section className={styles.productBar}>
        <div className={styles.queueMeta}>
          <span>{memory ? `Memory updated ${formatDateTime(memory.updatedAt)}` : 'No memory yet'}</span>
          <span>{run ? `${run.trigger} run ${formatDateTime(run.createdAt)}` : 'No run history'}</span>
          <span>Loaded {formatDateTime(loadedAt)}</span>
        </div>
      </section>
      <section className={styles.strategistGrid}>
        <section className={styles.strategistMain}>
          <div className={styles.adminSectionHeader}>
            <div><span className={styles.eyebrow}>Strategist Memory</span><h2>{memory ? 'Product intelligence' : 'No strategist memory yet'}</h2></div>
            <div className={styles.segmented}>
              <button className={memoryView === 'narrative' ? styles.segmentActive : ''} type="button" onClick={() => setMemoryView('narrative')}>Narrative</button>
              <button className={memoryView === 'structured' ? styles.segmentActive : ''} type="button" onClick={() => setMemoryView('structured')}>Structured</button>
            </div>
          </div>
          {memory ? (
            memoryView === 'narrative'
              ? <MarkdownLite markdown={memory.markdown} />
              : <StrategistStructured json={memory.json} />
          ) : (
            <div className={styles.emptyState}>
              {run?.status === 'pending' ? 'Run queued. The worker has not produced memory yet.' : 'Queue a strategist run to generate the first memory snapshot.'}
            </div>
          )}
        </section>
        <aside className={styles.strategistRecs}>
          <div className={styles.adminSectionHeader}><div><span className={styles.eyebrow}>Recommendations</span><h2>{filtered.length} {view}</h2></div></div>
          <div className={styles.segmented}>
            {(['pending', 'approved', 'rejected', 'tasked'] as const).map((status) => (
              <button className={view === status ? styles.segmentActive : ''} key={status} type="button" onClick={() => setView(status)}>{status}</button>
            ))}
          </div>
          <div className={styles.recommendationRows}>
            {filtered.length ? filtered.map((rec) => (
              <article className={styles.recommendationCard} key={rec.id}>
                <div className={styles.recommendationHead}>
                  <span>{rec.recommendationType || 'recommendation'}</span>
                  <strong>{rec.confidenceBand || 'MEDIUM'}</strong>
                </div>
                <h3>{rec.recommendedHook || rec.recommendedFormat || 'Untitled recommendation'}</h3>
                <dl>
                  <div><dt>Angle</dt><dd>{rec.recommendedAngle || '-'}</dd></div>
                  <div><dt>Persona</dt><dd>{rec.recommendedPersona || '-'}</dd></div>
                  <div><dt>Format</dt><dd>{rec.recommendedFormat || '-'}</dd></div>
                </dl>
                {rec.reasoning ? <p>{rec.reasoning}</p> : null}
                {rec.sourceCreative ? <small>Source: {rec.sourceCreative.hook || rec.sourceCreative.angle || rec.sourceCreative.adUrl || 'competitor creative'}</small> : null}
                <div className={styles.actionLinks}>
                  {rec.status === 'pending' ? (
                    <>
                      <button disabled={busyAction === `test:${rec.id}`} type="button" onClick={() => approveAndTest(rec)}>{busyAction === `test:${rec.id}` ? 'Creating...' : 'Approve & Test'}</button>
                      <button disabled={busyAction === `rec:${rec.id}`} type="button" onClick={() => updateRecommendation(rec, 'rejected')}>Reject</button>
                    </>
                  ) : null}
                  {rec.status === 'approved' ? <button disabled={busyAction === `test:${rec.id}`} type="button" onClick={() => approveAndTest(rec)}>{busyAction === `test:${rec.id}` ? 'Creating...' : 'Create test'}</button> : null}
                  {isLikelyClickUpTaskId(rec.taskId) ? <a href={`https://app.clickup.com/t/${rec.taskId}`} target="_blank" rel="noreferrer">ClickUp task</a> : null}
                  {rec.status === 'tasked' && !isLikelyClickUpTaskId(rec.taskId) ? <span>Action Plan item created</span> : null}
                </div>
              </article>
            )) : <div className={styles.emptyState}>No {view} recommendations.</div>}
          </div>
        </aside>
      </section>
    </>
  );
}
