import { isCreativeTrackerVisible } from './creative-tracker.js';

const normalize=(value)=>typeof value==='string'?value.toLowerCase().trim():'';
const fields=['angle','persona','funnelStage','hookType','creativeStructure'];
const overlap=(left,right)=>left.split(/\s+/).some((word)=>word.length>3 && right.split(/\s+/).includes(word));

// Derived evidence never mutates source JSON or writes on refresh.
export function inspirationDuplicateState(row,creatives) {
  const source=fields.map((field)=>normalize(row[field]));
  const groups={exact:[],combo:[],format:[]};
  if(!row.queueOnly && ['Saved','Classified','Approved'].includes(row.status) && (source[0] || source[1])) {
    for(const ad of creatives) {
      if(ad.productId!==row.productId || !isCreativeTrackerVisible(ad))continue;
      const same=fields.map((field,index)=>{
        const left=source[index],right=normalize(ad[field]);
        return !!left && !!right && (left===right || (index<2 && overlap(left,right)));
      });
      const matchType=same[0] && same[1]?(same[2]?'exact':'combo'):same[3] && same[4] && (same[0] || same[1])?'format':'';
      if(matchType)groups[matchType].push({id:ad.id,name:ad.formatName || ad.id,status:ad.status,matchType});
    }
  }
  const matches=Object.values(groups).flatMap((group)=>group.sort((a,b)=>a.id.localeCompare(b.id)));
  const duplicateType=matches.some((ad)=>['Winner','Mild Winner','Scale'].includes(ad.status))?'winner':matches.some((ad)=>ad.status==='Loser')?'loser':matches.length?'tested':'';
  const duplicate=!matches.length?'':groups.exact.length?'Exact match - same angle + persona + funnel stage already in Creative Tracker'
    :groups.combo.length?`This angle x persona combo has ${groups.combo.length} existing creative${groups.combo.length>1?'s':''} (different funnel stage)`
      :'Similar hook + structure format used in another creative for this angle/persona';
  const duplicateSignature=matches.length?JSON.stringify({v:1,productId:row.productId,id:row.id,source,matches:matches.map((ad)=>[ad.id,ad.name,ad.status,ad.matchType])}):'';
  return {duplicate,duplicateType,duplicateMatches:matches.slice(0,4),duplicateSignature,
    duplicateReviewed:!!duplicateSignature && row.editFields?._qaDupeReviewSignature===duplicateSignature};
}
