'use client';
import { BarChart3, Lightbulb, Clapperboard, ArrowUpRight } from 'lucide-react';
import { matrixInsights } from '../../../lib/domain/matrix-insights.js';
import type { Creative } from '../types';
import type { ReactNode } from 'react';
import styles from '../../command-center.module.css';

function Mix({ title, total, bars }: {title:string;total:number;bars:{label:ReactNode;name:string;value:number;color:string}[]}) {
  return <section className={styles.insightCard} aria-label={title}><h3>{title}</h3>{bars.map(bar=><div key={bar.name} className={styles.insightBar}>
    <span>{bar.label}</span><span role="meter" aria-label={bar.name} aria-valuemin={0} aria-valuemax={total} aria-valuenow={bar.value}><i style={{width:`${total ? bar.value/total*100 : 0}%`,background:bar.color}} /></span><b>{bar.value}</b>
  </div>)}</section>;
}
export function MatrixInsights({ creatives }: {creatives:Creative[]}) {
  const stats=matrixInsights(creatives);
  if(!stats.total) return <div className={styles.insightEmpty}><BarChart3 size={42} /><h3>No data yet</h3></div>;
  const statuses=[['winner','Winner','#6f9311'],['testing','Testing','#4d31b8'],['prelaunch','In Prod','#bf5b30'],['ready','Ready','#947200'],['untested','Untested','#a0a0a3'],['loser','Loser','#b72d54']] as const;
  return <div className={styles.insightsGrid}>
    <Mix title="Status mix" total={stats.total} bars={statuses.filter(([key])=>stats.counts[key]>0).map(([key,name,color])=>({name,label:name,value:stats.counts[key],color}))} />
    <Mix title="Funnel coverage" total={stats.total} bars={(['TOF','MOF','BOF'] as const).map((name,index)=>({name,label:name,value:stats.funnels[name],color:['#145a8c','#4d31b8','#bf5b30'][index]}))} />
    <Mix title="Source mix" total={stats.total} bars={[
      {name:'App-made',label:<><Clapperboard size={13} />App-made</>,value:stats.sources.app,color:'#bf5b30'},
      {name:'ClickUp',label:<><ArrowUpRight size={13} />ClickUp</>,value:stats.sources.clickup,color:'#145a8c'},
      {name:'Inspo',label:<><Lightbulb size={13} />Inspo</>,value:stats.sources.inspo,color:'#4d31b8'},
    ].filter(bar=>bar.value>0)} />
    <section className={`${styles.insightCard} ${styles.insightCadence}`} aria-label="Test cadence"><h3>Test cadence (last 12 weeks)</h3>
      <div className={styles.insightSpark}>{stats.cadence.map((count:number,index:number)=><div key={index} role="img" aria-label={`${count} creatives ${index===11 ? 'this week' : `${11-index}w ago`}`} title={`${count} creatives ${index===11 ? 'this week' : `${11-index}w ago`}`} data-current={index===11} style={{height:Math.max(2,count/Math.max(1,...stats.cadence)*56)}} />)}</div>
      <small>12w ago <span>now</span></small>
    </section>
    <section className={styles.insightCard} aria-label="Time to result"><h3>Time to result</h3><strong className={styles.insightNumber}>{stats.averageDays===null ? '-' : `${stats.averageDays}d`}</strong><span>avg from create to resolved</span><small>Estimated using last update</small></section>
    {stats.callout ? <div className={styles.insightCallout} data-tone={stats.callout.tone}><strong>{stats.callout.title}</strong> {stats.callout.text}</div> : null}
  </div>;
}
