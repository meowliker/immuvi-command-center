import { normalizeTaxonomyName, taxonomySimilarityScore, taxonomyKey, deriveTaxonomyStatus, taxonomyStats, preferredMergeTarget } from './taxonomy.js';
import { normalizeCreativeRow, isCreativeTrackerVisible } from './creative-tracker.js';
import { inspirationRequest } from './inspiration-editing.js';

/** @returns {Array<Record<string,any>>} */
export function activeInspirationTaxonomy(productId,rows) {
  return rows.filter((row)=>row.product_id===productId && row.id && row.name && !row.archived_at && !row.deleted_at && !row.meta?._productBoundaryQuarantined);
}
/** @returns {Array<Record<string,any>>} */
export function inspirationSuggestions(row,kind,items,creatives=[]) {
  const detected=row.editFields?.[kind==='angle'?'detectedAngle':'detectedPersona'] || row[kind] || '';
  const own=creatives.filter((ad)=>ad.productId===row.productId && isCreativeTrackerVisible(ad));
  const ranked=activeInspirationTaxonomy(row.productId,items).map((item)=>({...item,createdAt:item.created_at,
    score:taxonomySimilarityScore(detected,item.name),status:deriveTaxonomyStatus(kind,item.name,own),creativeCount:taxonomyStats(kind,item.name,own).creatives}));
  const statusRank=(status)=>({Winner:60,Scale:50,'Mild Winner':50,'Ready to Launch':40,Ready:40,'In Production':30,Testing:20,Untested:10,Loser:0,Killed:0}[status] ?? 5);
  ranked.sort((a,b)=>b.score-a.score || statusRank(b.status)-statusRank(a.status) || b.creativeCount-a.creativeCount || a.name.localeCompare(b.name));
  const current=ranked.find((item)=>taxonomyKey(item.name)===taxonomyKey(row[kind]));
  let preferred=null;
  // Merge-target preference uses its own legacy ordering, separate from match ranking.
  if(current)for(const other of activeInspirationTaxonomy(row.productId,items)) {
    const candidate=ranked.find((item)=>item.id===other.id);
    if(candidate===current)continue;
    const score=taxonomySimilarityScore(current.name,candidate.name);
    if(score<.72 || taxonomyKey(candidate.name)===taxonomyKey(current.name))continue;
    const keep=preferredMergeTarget(kind,current,candidate,{creatives:current.creativeCount},{creatives:candidate.creativeCount},own);
    if(keep!==candidate)continue;
    if(!preferred || score>preferred.score || candidate.creativeCount>preferred.creativeCount)preferred={...candidate,score};
  }
  return preferred?[preferred,...ranked.filter((item)=>item.id!==preferred.id)]:ranked;
}
export function inspirationMappingRequest(row,kind,mode,name,target,requestId=crypto.randomUUID()) {
  if(!['angle','persona'].includes(kind) || !['existing','custom','new'].includes(mode))throw new Error('Invalid mapping choice.');
  const value=mode==='existing'?String(target?.name || ''):normalizeTaxonomyName(name);
  if(!value || value.length>200)throw new Error('Enter a name between 1 and 200 characters.');
  if(mode==='existing' && (!target?.id || !target.updated_at || target.product_id!==row.productId || target.archived_at))throw new Error('Select an active taxonomy entry.');
  const request=inspirationRequest(row.productId,'save',row,{[kind]:value},{},requestId);
  request.p_values.mapping={kind,mode,targetId:mode==='existing'?target.id:null,targetVersion:mode==='existing'?target.updated_at:null};
  return request;
}
export function eligibleInspirationCreatives(productId,ads,tombstones=[]) {
  const deleted=new Set(tombstones.filter((row)=>row.product_id===productId).flatMap((row)=>[row.id,row.clickup_task_id]).filter(Boolean));
  return ads.filter((row)=>row.product_id===productId).map(normalizeCreativeRow).filter((ad)=>isCreativeTrackerVisible(ad) && !deleted.has(ad.id) && !deleted.has(ad.clickupTaskId));
}
export function inspirationDuplicateLinks(row,creatives) {
  const refs=row.duplicateMatches ?? (Array.isArray(row.editFields?._dupeSimilar)?row.editFields._dupeSimilar:[]);
  const result=[],seen=new Set();
  for(const ref of refs) {
    const id=typeof ref==='string'?ref:ref?.id;
    if(typeof id!=='string' || !id || seen.has(id))continue;seen.add(id);
    const matches=creatives.filter((ad)=>ad.productId===row.productId && (ad.id===id || ad.clickupTaskId===id));
    if(matches.length!==1) {if(!result.some((item)=>item.id===id))result.push({id,available:false,title:'Creative unavailable',status:'',matchType:''});continue;}
    const ad=matches[0];
    const existing=result.findIndex((item)=>item.id===ad.id);
    if(existing>=0){if(result[existing].available)continue;result.splice(existing,1);}
    result.push({id:ad.id,available:true,title:ad.formatName || ad.id,status:ad.status,matchType:['exact','combo','format'].includes(ref?.matchType)?ref.matchType:''});
  }
  return result;
}
export function mappingNeedsReview(row,kind,items) {
  const flag=kind==='angle'?'_needsAngleReview':'_needsPersonaReview';
  return !!row.editFields?.[flag] || !row[kind] || !activeInspirationTaxonomy(row.productId,items).some((item)=>taxonomyKey(item.name)===taxonomyKey(row[kind]));
}
