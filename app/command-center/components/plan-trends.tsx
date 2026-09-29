import { planTrends } from '../../../lib/domain/action-plan-dates.js';
import type { ActionRecord } from '../types';
import styles from '../../command-center.module.css';

const METRICS = [['created', 'Created'], ['launched', 'Launched'], ['decided', 'Decided']] as const;
export function PlanTrends({ actions, now, stuck }: { actions: ActionRecord[]; now: number; stuck: number }) {
  const trends = planTrends(actions, now);
  return <section aria-label="Action Plan trends" className={styles.planTrends}>
    <header><h3>Last 30 days</h3><span>All product tasks</span><time>{trends.days[0].date} to {trends.days.at(-1)!.date}</time></header>
    <div className={styles.planTrendCharts}>{METRICS.map(([metric, label]) => {
      const total = trends.days.reduce((sum, day) => sum + day[metric], 0);
      const max = Math.max(1, ...trends.days.map((day) => day[metric]));
      return <section key={metric} data-trend={metric}>
        <header><h4>{label}</h4><strong data-trend-total={metric}>{total}</strong></header>
        <div className={styles.planTrendBars} role="img" aria-label={`${label}: ${total} in the last 30 days`}>
          {trends.days.map((day) => <span key={day.date} data-trend-date={day.date} data-count={day[metric]} title={`${day.date}: ${day[metric]}`} style={{ height: `${day[metric] * 100 / max}%` }} />)}
        </div>
      </section>;
    })}</div>
    <dl className={styles.planTrendKpis}><div><dt>Win rate</dt><dd data-trend-win-rate>{trends.winRate}%</dd></div><div><dt>Winners</dt><dd>{trends.winners}</dd></div><div><dt>Losers</dt><dd>{trends.losers}</dd></div><div><dt>Stuck right now</dt><dd data-trend-stuck>{stuck}</dd></div></dl>
    <details className={styles.planTrendDetails}><summary>Daily totals</summary><table><caption>All product tasks, last 30 days</caption><thead><tr><th scope="col">Date</th>{METRICS.map(([metric, label]) => <th scope="col" key={metric}>{label}</th>)}</tr></thead>
      <tbody>{trends.days.map((day) => <tr key={day.date}><th scope="row">{day.date}</th>{METRICS.map(([metric]) => <td key={metric}>{day[metric]}</td>)}</tr>)}</tbody>
    </table></details>
  </section>;
}
