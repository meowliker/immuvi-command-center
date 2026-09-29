import test from 'node:test';
import assert from 'node:assert/strict';
import {projectInspirationLibrary} from '../../lib/domain/inspiration-library.js';
import {inspirationPulse,inspirationInsights,inspirationTrends,matchesInspirationPulse,isClassifiedInspiration,inspirationWindows} from '../../lib/domain/inspiration-analytics.js';
import {applyPulsePeriod} from '../../lib/domain/action-plan-pulse-period.js';
process.env.TZ='America/New_York';
const now=new Date(2026,8,23,12).getTime(),today=new Date(2026,8,23,10).toISOString();
const period={pulseRange:false,datePreset:'all',dateFrom:'',dateTo:''};
const source=(id,extra={})=>({id,product_id:'qa',title:id,status:'Classified',created_at:today,data:{angle:'Energy',hookType:'Question'},...extra});
const ad=(id,sourceId,status='Winner',extra={})=>({id,product_id:'qa',status,created_at:today,meta:{_fromInspoId:sourceId},...extra});
const project=(rows,ads=[],queue=[],deleted=[])=>projectInspirationLibrary('qa',rows,queue,ads,deleted,[]);
test('Pulse metrics and row membership share classification, queue and creative predicates',()=>{
  const rows=project([source('A'),source('B',{status:'Saved',data:{}}),source('C',{status:'Failed'}),source('D',{status:'Classified'})],
    [ad('W','A'),ad('L','A','Loser'),ad('T','D','In production')],[{id:'Q',ins_id:'ONLY',product_id:'qa',status:'failed',worker_assignment:'blocked:qa-isolation',queued_at:today}]);
  const counts=inspirationPulse(rows,period,now);
  assert.equal(counts.today.classified,2);assert.equal(counts.today.failed,1);assert.equal(counts.today.blocked,1);assert.equal(counts.today.placed,3);
  assert.deepEqual(rows.filter((row)=>matchesInspirationPulse(row,'period:placed',period,now)).map((row)=>row.id),['A','D']);
  assert.equal(counts.period.tested,1);assert.equal(counts.period.winners,1);assert.equal(counts.period.killed,1);
  assert.equal(matchesInspirationPulse(rows[0],'invalid:placed',period,now),false);
});
test('missing and future timestamps never count as activity; classified timestamp wins over intake',()=>{
  const rows=project([source('A',{created_at:'2020-01-01',data:{classifiedAt:now-1000}}),source('F',{created_at:new Date(now+1000).toISOString()}),source('M',{created_at:'invalid'}),source('N',{data:{classifiedAt:Infinity},created_at:null})],[ad('NO','A','Winner',{created_at:'bad'}),ad('FUT','A','Winner',{created_at:new Date(now+1000).toISOString()})]);
  assert.equal(inspirationPulse(rows,period,now).today.classified,1);assert.equal(inspirationPulse(rows,period,now).today.placed,0);
  assert.equal(inspirationTrends(rows,now).reduce((sum,day)=>sum+day.classified,0),1);
});
test('classified requires a real row with ready state or classification evidence, not a queued failure',()=>{
  for(const status of ['Classified','Approved','Testing','Winner','Mild Winner','Scale','Loser','Killed'])assert.equal(isClassifiedInspiration({status}),true);
  for(const status of ['Saved','Queued','Classifying','Blocked','Failed','Unknown'])assert.equal(isClassifiedInspiration({status}),false);
  assert.equal(isClassifiedInspiration({status:'Saved',briefUrl:'https://example.test/brief'}),true);
  assert.equal(isClassifiedInspiration({status:'Classified',queueOnly:true}),false);
});
test('insights group decided creatives, count mixed as winner and keep undecided rates unknown',()=>{
  const rows=project([source('M'),source('T',{data:{angle:'Undecided'}}),source('U',{data:{angle:'__proto__'}})],
    [ad('W','M','Complete'),ad('MILD','M','Mild Winner'),ad('L','M','Killed'),ad('T','T','Testing')],[{ins_id:'QUEUE',product_id:'qa',status:'pending'}]);
  const insights=inspirationInsights(rows);
  assert.equal(insights.total,3);assert.deepEqual(insights.funnel,{unused:1,placed:0,testing:1,winner:1,loser:0});
  assert.equal(insights.angles[0].winRate,67);assert.equal(insights.angles.find((group)=>group.name==='Undecided').winRate,null);
  assert.equal(insights.unused[0].id,'U');assert.equal(insights.angles.find((group)=>group.name==='__proto__').total,1);
});
test('usage excludes foreign, duplicate, soft-deleted, quarantined and canonical remote tombstones',()=>{
  const a=ad('OK','A','Winner'),rows=project([source('A'),source('FOREIGN',{product_id:'elsewhere'})],[a,a,ad('FOREIGN','A','Winner',{product_id:'elsewhere'}),ad('SOFT','A','Winner',{deleted_at:today}),ad('Q','A','Winner',{meta:{_fromInspoId:'A',_productBoundaryQuarantined:true}}),ad('DELETED','A','Winner',{meta:{_fromInspoId:'A',clickupTaskId:'removed',_clickupId:'old'}})],[],[{product_id:'qa',clickup_task_id:'removed'}]);
  assert.equal(inspirationPulse(rows,period,now).period.placed,1);assert.equal(inspirationInsights(rows).angles[0].winners,1);
});
test('legacy creative timestamps/status are projected for trends and Pulse',()=>{
  const rows=project([source('A')],[ad('LEGACY','A','',{created_at:null,meta:{_fromInspoId:'A',createdAt:now-1000,status:'Scale'}})]);
  assert.equal(inspirationPulse(rows,period,now).period.winners,1);assert.equal(inspirationTrends(rows,now).at(-1).placed,1);
});
test('group ranking uses exact rates before rounding percentages for display',()=>{
  const row=(id,won,lost)=>({id,angle:id,hookType:'Question',performance:'mixed',createdAt:now,usage:[...Array.from({length:won},()=>({status:'Winner'})),...Array.from({length:lost},()=>({status:'Loser'}))]});
  const groups=inspirationInsights([row('Lower',667,333),row('Higher',67,33)]).angles;
  assert.deepEqual(groups.map((group)=>group.winRate),[67,67]);assert.deepEqual(groups.map((group)=>group.name),['Higher','Lower']);
});
test('local calendar trend days survive DST; all fourteen days and the current local date are present',()=>{
  const clock=new Date(2026,2,9,12).getTime(),rows=project([source('A',{created_at:new Date(2026,2,8,23,30).toISOString()})]);
  const days=inspirationTrends(rows,clock);
  assert.equal(days.length,14);assert.equal(new Set(days.map((day)=>day.date)).size,14);assert.equal(days.at(-1).date,'2026-03-09');
  assert.equal(days.find((day)=>day.date==='2026-03-08').classified,1);
});
test('period defaults compare last calendar week; custom dates include final milliseconds and retain filter keys',()=>{
  const prior=new Date(2026,8,20,23,59,59,999).getTime();
  const rows=project([source('A'),source('B',{created_at:new Date(prior).toISOString()})]);
  assert.equal(inspirationPulse(rows,period,now).delta.classified,0);
  const custom=applyPulsePeriod({...period,pulseKeys:['keep']},'custom',{from:'2026-09-20',to:'2026-09-20'},now);
  assert.deepEqual(custom.pulseKeys,['keep']);assert.equal(inspirationPulse(rows,custom,now).period.classified,1);
  const windows=inspirationWindows(custom,now);assert.equal(windows.period.to-windows.period.from,windows.prior.to-windows.prior.from);
  assert.throws(()=>applyPulsePeriod(period,'custom',{from:'2026-09-23',to:'2026-09-20'},now),/End date/);
});
