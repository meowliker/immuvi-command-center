'use client';
import { X } from 'lucide-react';
import type { Inspiration } from '../hooks/use-inspiration-library';
import type { PlanFilters } from './plan-toolbar';
import { PlanPulsePeriod } from './plan-pulse-period';
import { pulsePeriodLabel } from '../../../lib/domain/action-plan-pulse-period.js';
import { inspirationPulse, inspirationInsights, inspirationTrends, INSPIRATION_TODAY, INSPIRATION_PERIOD, INSPIRATION_METRIC_LABELS } from '../../../lib/domain/inspiration-analytics.js';
import styles from '../inspiration-analytics.module.css';

const icons={pending:'🟡',classifying:'🔵',blocked:'!',classified:'✨',placed:'📌',failed:'⊘',tested:'🧪',winners:'🏆',killed:'⊘'};
const tones={pending:'production',classifying:'briefed',blocked:'production',classified:'ready',placed:'created',failed:'decisions',tested:'tested',winners:'winners',killed:'killed'};
export function InspirationPulse({rows,loaded,period,change,selected,toggle,now,queue,workerCount=null}:{rows:Inspiration[];loaded:boolean;period:PlanFilters;change:(value:PlanFilters)=>void;selected:string;toggle:(key:string)=>void;now:number;queue:()=>void;workerCount?:number|null}) {
  const counts=inspirationPulse(rows,period,now);
  return <section className={styles.pulse} aria-label="Inspiration pulse">
    {(['today','period'] as const).map((scope)=><div className={styles.period} key={scope}>
      <header><h3><span aria-hidden="true">●</span> {scope==='today'?'Today':pulsePeriodLabel(period)}</h3><small>{scope==='period'?(period.pulseRange?'vs prior period of equal length':'Mon → today · vs last week'):<time>{new Date(now).toLocaleDateString('en',{weekday:'long',month:'short',day:'numeric'})}</time>}</small>
        {scope==='period'?<PlanPulsePeriod filters={period} change={change} now={now}/>:<button className={styles.queue} type="button" title="Queue and worker health" onClick={queue}>{workerCount===null?'Worker status':workerCount?`${workerCount} worker${workerCount===1?'':'s'} live`:'No workers'}</button>}
      </header>
      <div className={styles.tiles}>{(scope==='today'?INSPIRATION_TODAY:INSPIRATION_PERIOD).map((metric)=>{
        const key=`${scope}:${metric}`,emoji=icons[metric as keyof typeof icons],label=INSPIRATION_METRIC_LABELS[metric as keyof typeof INSPIRATION_METRIC_LABELS];
        const delta=counts.delta[metric as keyof typeof counts.delta];
        return <button key={key} type="button" data-inspiration-pulse={key} data-metric={tones[metric as keyof typeof tones]} aria-label={`${scope==='today'?'Today':'Period'} ${label}`} aria-pressed={selected===key} disabled={!loaded} onClick={()=>toggle(key)}>
          <span className={styles.emoji} aria-hidden="true">{emoji}</span><span className={styles.metric}>{label}<strong data-inspiration-count>{loaded?counts[scope][metric]:'-'}</strong></span>
          {scope==='period' && ['classified','placed'].includes(metric) && loaded && !!delta?<small className={styles.delta} data-negative={delta<0} title="Change versus prior period">{delta>0?'↑':'↓'}{Math.abs(delta)}</small>:null}
        </button>;
      })}</div>
    </div>)}
    {selected?<div className={styles.selection}><button type="button" aria-label="Clear Inspiration pulse filter" onClick={()=>toggle(selected)}>{selected.startsWith('today:')?'Today':'Period'}: {INSPIRATION_METRIC_LABELS[selected.split(':')[1] as keyof typeof INSPIRATION_METRIC_LABELS]}<X size={13}/></button></div>:null}
  </section>;
}
export function InspirationInsights({rows,now,open}:{rows:Inspiration[];now:number;open:(id:string)=>void}) {
  const insights=inspirationInsights(rows),max=Math.max(1,...Object.values(insights.funnel));
  if(!insights.total)return <p className={styles.empty}>No inspirations yet.</p>;
  return <div className={styles.grid} aria-label="Inspiration insights">
    <section><header><h3>Replication Funnel</h3><span>{insights.total} inspirations</span></header>
      {Object.entries(insights.funnel).map(([key,value])=><div className={styles.funnel} key={key} data-funnel={key}><span>{key.charAt(0).toUpperCase()+key.slice(1)}</span><div><i data-kind={key} style={{width:`${value/max*100}%`}}/></div><strong>{value}</strong></div>)}
    </section>
    {([['Angle',insights.angles],['Hook',insights.hooks]] as const).map(([label,groups])=><section key={label}><header><h3>Win-rate by {label}</h3></header>
      {groups.length?<div className={styles.tableWrap}><table aria-label={`Win-rate by ${label}`}><thead><tr><th>{label}</th><th>Inspos</th><th>Ads (W/L)</th><th>Win-rate</th></tr></thead><tbody>{groups.map((group)=><tr key={group.name}><td>{group.name}</td><td>{group.total}</td><td>{group.winners}/{group.losers}</td><td>{group.winRate===null?'-':`${group.winRate}%`}</td></tr>)}</tbody></table></div>:<p className={styles.empty}>No {label.toLowerCase()} data yet.</p>}
    </section>)}
    <section><header><h3>Unused Gold Mine</h3><span>{insights.unused.length} never placed</span></header>
      {insights.unused.length?<ul className={styles.unused}>{insights.unused.slice(0,30).map((row:Inspiration)=><li key={row.id}><button type="button" onClick={()=>open(row.id)} aria-label={`Open unused inspiration ${row.id}`}><b>{row.id}</b><span>{row.formatName}</span><small>{row.createdAt>0 && row.createdAt<=now?`${Math.floor((now-row.createdAt)/86400000)}d ago`:'-'}</small></button></li>)}</ul>:<p className={styles.empty}>All inspirations have been placed.</p>}
      {insights.unused.length>30?<p className={styles.empty}>+ {insights.unused.length-30} more</p>:null}
    </section>
  </div>;
}
export function InspirationTrends({rows,now}:{rows:Inspiration[];now:number}) {
  const days=inspirationTrends(rows,now);
  return <div className={styles.grid} aria-label="Inspiration trends">
    {(['classified','placed'] as const).map((metric)=>{
      const max=Math.max(1,...days.map((day)=>day[metric])),total=days.reduce((sum,day)=>sum+day[metric],0),label=metric==='classified'?'Inspirations Added':'Placed in Matrix';
      return <section key={metric}><header><h3>{label}</h3><span>{total} {metric} / 14d</span></header>
        <div className={styles.chartScroll} tabIndex={0} role="region" aria-label={`${label} over 14 days`}><div className={styles.chart}>{days.map((day)=><div key={day.date} className={styles.column} aria-label={`${day.date}: ${day[metric]} ${metric}`} title={`${day.date}: ${day[metric]}`}>
          <span>{day[metric]}</span><div><i data-kind={metric} style={{height:`${day[metric]/max*100}%`}}/></div><time dateTime={day.date}>{Number(day.date.slice(5,7))}/{Number(day.date.slice(8))}</time>
        </div>)}</div></div>
      </section>;
    })}
  </div>;
}
