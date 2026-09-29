export const INSPIRATION_OPTIONS = {
  platform:['Facebook','Instagram','TikTok','YouTube','Other'],
  status:['Queued','Classifying','Blocked','Failed','Cancelled','Saved','Classified','Approved','Briefed','Live','Winner','Loser'],
  creativeStructure:['UGC','Testimonial','Demo','Tutorial / How-To','Story / Narrative','Hook + Offer','Listicle','Static / Photo','Comparison','Interview','Skit / Roleplay','AI / Voiceover'],
  hookType:['Pain / Problem','Fear','Curiosity','Social Proof','Aspirational','Direct Offer','Controversy / Bold Claim','POV','Question','News / Trend','Pattern Interrupt'],
  productionStyle:['Organic / Raw UGC','Polished UGC','Professional Studio','AI Generated','Screen Record','Animation / Motion','Static Graphic','Slideshow','Repurposed Organic','Competitor Inspired'],
  funnelStage:['TOF','MOF','BOF'],adType:['Video','Photo','Carousel','UGC','VSL','AI Style'],
  performance:['unused','placed','testing','winner','loser','mixed'],source:['original','imported'],
};
export function inspirationRelativeDate(value,now) {
  if(!Number.isFinite(value) || !value)return '-';
  const seconds=Math.max(0,Math.floor((now-value)/1000));
  for(const [unit,size] of [['w',604800],['d',86400],['h',3600],['m',60]])if(seconds>=size)return `${Math.floor(seconds/size)}${unit} ago`;
  return `${seconds}s ago`;
}
export function inspirationUsageCounts(row) {
  const counts={winner:0,loser:0,testing:0,placed:0};
  for(const ad of row.usage) {
    const key=/^(winner|mild winner|scale|complete)$/i.test(ad.status)?'winner':/^(loser|killed)$/i.test(ad.status)?'loser':/^(testing|in production|ready to launch)$/i.test(ad.status)?'testing':'placed';
    counts[key]++;
  }
  return counts;
}
