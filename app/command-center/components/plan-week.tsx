'use client';
import { planWeekDays } from '../../../lib/domain/action-plan-layouts.js';
import type { ActionRecord } from '../types';
import styles from '../../command-center.module.css';

export function PlanWeek({ actions, now }: { actions: ActionRecord[]; now: number }) {
  const days = planWeekDays(actions, now);
  const date = (ms: number) => new Date(ms).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
  return <section aria-label="Action Plan week" className={styles.planWeek}>
    <h3>{date(days[0].start)} - {date(days[6].start)}</h3>
    <div className={styles.planWeekGrid}>{days.map((day) => <section key={day.start} data-week-start={day.start} data-future={day.future} className={styles.planWeekDay}>
      <header><h4>{new Date(day.start).toLocaleDateString('en', { weekday: 'short' })}</h4><time dateTime={new Date(day.start).toLocaleDateString('en-CA')}>{date(day.start)}</time></header>
      {day.future ? <p className={styles.planColumnEmpty}>Upcoming</p> : <dl>{(['created', 'launched', 'decided'] as const).map((metric) => <div key={metric}><dt>{metric[0].toUpperCase() + metric.slice(1)}</dt><dd data-week-metric={metric}>{day[metric]}</dd></div>)}</dl>}
    </section>)}</div>
  </section>;
}
