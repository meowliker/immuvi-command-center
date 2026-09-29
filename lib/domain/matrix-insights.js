import { matrixBucket, matrixSource } from './creative-matrix.js';

/** @param {ReturnType<typeof import('./creative-tracker.js').normalizeCreativeRow>[]} ads */
export function matrixInsights(ads, now=Date.now()) {
  const counts={winner:0,testing:0,prelaunch:0,ready:0,untested:0,loser:0};
  const funnels={TOF:0,MOF:0,BOF:0}, sources={app:0,clickup:0,inspo:0};
  const cadence=Array(12).fill(0);
  let elapsed=0, resolved=0, latest=0;
  for(const ad of ads) {
    counts[ad.status==='Ready to Launch' ? 'ready' : matrixBucket(ad.status)]++;
    if(Object.hasOwn(funnels,ad.funnelStage)) funnels[ad.funnelStage]++;
    sources[matrixSource(ad)]++;
    if(ad.createdAt) {
      latest=Math.max(latest,ad.createdAt);
      const week=Math.floor((now-ad.createdAt)/(7*86400000));
      if(week>=0 && week<12) cadence[11-week]++;
    }
    // Match the legacy estimate; updatedAt is not necessarily a status transition.
    if(['Winner','Mild Winner','Scale','Loser'].includes(ad.status) && ad.createdAt && ad.updatedAt>ad.createdAt) {
      elapsed+=(ad.updatedAt-ad.createdAt)/86400000;resolved++;
    }
  }
  let callout=null;
  if(counts.winner && ads.length<3) callout={tone:'warn',title:'Replication opportunity.',text:`${counts.winner} winning creative${counts.winner===1 ? '' : 's'} but only ${ads.length} total. Test 2-3 more variations.`};
  else if(counts.winner && (!funnels.MOF || !funnels.BOF)) callout={tone:'warn',title:'Funnel gap.',text:`Winner detected but no ${['MOF','BOF'].filter(funnel=>!funnels[funnel]).join(' + ')} creative. Build retargeting variations for the warm audience.`};
  else if(counts.loser>=2 && !counts.winner) callout={tone:'bad',title:'Diminishing returns.',text:`${counts.loser} losers, no winners yet. Consider changing the angle/persona pairing before further testing.`};
  else if(counts.winner && !counts.loser && ads.length>=3) callout={tone:'win',title:'Solid pocket.',text:`Winners with no losers across ${ads.length} creatives.`};
  else if(latest && now-latest>14*86400000) callout={tone:'warn',title:'Stale pocket.',text:'No new creative in the last 14 days. Consider refreshing this pairing.'};
  return {total:ads.length,counts,funnels,sources,cadence,averageDays:resolved ? Math.round(elapsed/resolved) : null,callout};
}
