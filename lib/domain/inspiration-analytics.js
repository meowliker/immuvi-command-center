import { planDateRange, planDayKey } from './action-plan-dates.js';

export const INSPIRATION_TODAY = ['pending','classifying','blocked','classified','placed','failed'];
export const INSPIRATION_PERIOD = ['classified','placed','tested','winners','killed'];
export const INSPIRATION_METRIC_LABELS = {pending:'Pending',classifying:'Classifying',blocked:'Blocked',classified:'Classified',placed:'Placed',failed:'Failed',tested:'Tested',winners:'Winners',killed:'Killed'};
const winning = (status) => /^(winner|mild winner|scale|complete)$/i.test(status);
const losing = (status) => /^(loser|killed)$/i.test(status);
const testing = (status) => /^(testing|in production|ready to launch)$/i.test(status);
const inside = (time,range,now) => Number.isFinite(time) && time>0 && time>=range.from && time<range.to && time<=now;
export function isClassifiedInspiration(row) {
  return !row.queueOnly && (/^(classified|approved|testing|winner|mild winner|scale|loser|killed)$/i.test(row.status)
    || /^saved$/i.test(row.status) && !!(row.briefUrl || row.hookType || row.creativeStructure || row.angle));
}
export function inspirationWindows(period,now) {
  const current=planDateRange(period.pulseRange?period:{datePreset:'week'},now);
  const to=Math.min(current.to,now+1);
  const prior=period.pulseRange ? {from:current.from-Math.max(1,to-current.from),to:current.from} : planDateRange({datePreset:'lastweek'},now);
  return {today:planDateRange({datePreset:'today'},now),period:current,prior};
}
function metricCount(row,metric,range,now) {
  const pipeline={pending:'Queued',classifying:'Classifying',blocked:'Blocked',failed:'Failed'};
  if(pipeline[metric])return Number(row.status===pipeline[metric]);
  if(row.queueOnly)return 0;
  if(metric==='classified')return Number(isClassifiedInspiration(row) && inside(row.createdAt,range,now));
  return row.usage.filter((ad)=>inside(ad.createdAt,range,now) && (metric==='placed' || metric==='tested' && testing(ad.status) || metric==='winners' && winning(ad.status) || metric==='killed' && losing(ad.status))).length;
}
export function inspirationPulse(rows,period,now) {
  const windows=inspirationWindows(period,now),count=(metrics,range)=>Object.fromEntries(metrics.map((metric)=>[metric,rows.reduce((sum,row)=>sum+metricCount(row,metric,range,now),0)]));
  const current=count(INSPIRATION_PERIOD,windows.period),prior=count(INSPIRATION_PERIOD,windows.prior);
  return {today:count(INSPIRATION_TODAY,windows.today),period:current,delta:{classified:current.classified-prior.classified,placed:current.placed-prior.placed}};
}
export function matchesInspirationPulse(row,key,period,now) {
  if(!key)return true;
  const [scope,metric]=key.split(':');
  if(!(scope==='today'?INSPIRATION_TODAY:scope==='period'?INSPIRATION_PERIOD:[]).includes(metric))return false;
  return metricCount(row,metric,inspirationWindows(period,now)[scope],now)>0;
}
export function inspirationInsights(rows) {
  const inspirations=rows.filter((row)=>!row.queueOnly),funnel={unused:0,placed:0,testing:0,winner:0,loser:0};
  for(const row of inspirations)funnel[row.performance==='mixed'?'winner':row.performance]++;
  function groups(field) {
    const grouped=new Map();
    for(const row of inspirations) {
      const name=row[field]?.trim() || '-',group=grouped.get(name) || {name,total:0,winners:0,losers:0,ads:0};
      group.total++;group.ads+=row.usage.length;
      group.winners+=row.usage.filter((ad)=>winning(ad.status)).length;group.losers+=row.usage.filter((ad)=>losing(ad.status)).length;grouped.set(name,group);
    }
    const rate=(group)=>group.winners+group.losers?group.winners/(group.winners+group.losers):null;
    return [...grouped.values()].filter((group)=>group.name!=='-' || group.ads).map((group)=>({...group,winRate:rate(group)===null?null:Math.round(rate(group)*100)}))
      .sort((a,b)=>(rate(b)??-1)-(rate(a)??-1) || b.ads-a.ads || a.name.localeCompare(b.name)).slice(0,8);
  }
  return {total:inspirations.length,funnel,angles:groups('angle'),hooks:groups('hookType'),unused:inspirations.filter((row)=>!row.usage.length).sort((a,b)=>b.createdAt-a.createdAt || a.id.localeCompare(b.id))};
}
export function inspirationTrends(rows,now) {
  const today=new Date(now);today.setHours(0,0,0,0);
  const days=Array.from({length:14},(_,index)=>{const day=new Date(today);day.setDate(day.getDate()+index-13);return {date:planDayKey(day),classified:0,placed:0};});
  const byDay=new Map(days.map((day)=>[day.date,day]));
  for(const row of rows) {
    if(row.queueOnly)continue;
    if(isClassifiedInspiration(row) && row.createdAt>0 && row.createdAt<=now) {const day=byDay.get(planDayKey(row.createdAt));if(day)day.classified++;}
    for(const ad of row.usage)if(ad.createdAt>0 && ad.createdAt<=now){const day=byDay.get(planDayKey(ad.createdAt));if(day)day.placed++;}
  }
  return days;
}
