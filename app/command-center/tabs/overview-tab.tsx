import type { SupabaseClient } from '@supabase/supabase-js';
import { productClickUpListId } from '../../../lib/domain/product-config.js';
import { useCommandHq } from '../hooks/use-command-hq';
import { PlanHistory } from '../components/plan-history';
import { ProductAdministration } from '../components/product-administration';
import styles from '../../command-center.module.css';
import type { Product, Profile } from '../types';

const METRICS = [['total', 'Total Creatives'], ['winners', 'Winners'], ['testing', 'Testing'], ['ready', 'Ready to Launch'], ['untested', 'Untested'], ['winRate', 'Win Rate'], ['angles', 'Angles'], ['personas', 'Personas']] as const;

export function OverviewTab({
  supabase,
  profile,
  products,
  activeProduct,
  switchProduct,
}: {
  supabase: SupabaseClient;
  profile: Profile;
  products: Product[];
  activeProduct?: Product;
  switchProduct: (productId: string) => void;
}) {
  const { data, busy, error } = useCommandHq(supabase, activeProduct?.id || '');
  return (
    <div className={styles.hqSurface}>
      <section className={styles.hqProducts} aria-label="Product profiles">
        <ProductAdministration db={supabase} userId={profile.id} product={activeProduct} profile={profile}>
        <div className={styles.hqProductChoices}>
          {products.map((product) => <button key={product.id} type="button" aria-pressed={product.id === activeProduct?.id} onClick={() => switchProduct(product.id)}>
            <i aria-hidden="true" style={{ backgroundColor: typeof product.config?.color === 'string' && /^#[0-9a-f]{6}$/i.test(product.config.color) ? product.config.color : '#4f46e5' }} /><span>{product.name || product.id}</span><small data-linked={Boolean(productClickUpListId(product))}>{productClickUpListId(product) ? 'ClickUp' : 'No ClickUp'}</small>
          </button>)}
        </div>
        </ProductAdministration>
      </section>
      {error && <p role="alert">{error}{data ? ' Showing the last successful snapshot.' : ''}</p>}
      {activeProduct && <>
        {!data && <p role="status">{error ? 'Command HQ data unavailable.' : 'Loading Command HQ...'}</p>}
        <section className={styles.hqMetrics} aria-label="Command HQ metrics" aria-busy={busy} tabIndex={0}>
          {METRICS.map(([key, label]) => <div key={key} data-hq-metric={key}><strong>{data ? key === 'winRate' ? `${data.summary[key].toFixed(1)}%` : data.summary[key] : '-'}</strong><span>{label}</span></div>)}
        </section>
        {data && <>
          <h2 className={styles.hqSectionTitle}>Coverage Intelligence</h2>
          <section className={styles.hqCoverage} aria-label="Coverage Intelligence">
            {data.coverage.map((group) => <article key={group.field} data-hq-coverage={group.field}>
              <h3>{group.label}</h3><progress max={100} value={group.percent} aria-label={`${group.label} coverage`} />
              <p>{group.percent}% coverage ({group.covered}/{group.total})</p>
              {group.items.length ? <ul>{group.items.map((item) => <li key={item.name} data-covered={item.count > 0}><span>{item.name}</span><span>{item.count}</span></li>)}</ul> : <p>No active {group.label.toLowerCase()}.</p>}
            </article>)}
          </section>
          <section className={styles.hqGaps} aria-label="Gap Analysis"><h2 className={styles.hqSectionTitle}>Gap Analysis</h2>
            <div className={styles.hqGapBox}>{data.gaps.length ? <ul>{data.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul> : <p>{data.summary.total ? 'All gaps covered. Great work!' : 'No creatives yet.'}</p>}</div>
          </section>
        </>}
        <div className={styles.hqActivity}><PlanHistory db={supabase} productId={activeProduct.id} /></div>
      </>}
    </div>
  );
}
