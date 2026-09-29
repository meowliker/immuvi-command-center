import { projectInspirationLibrary, inspirationLink } from './inspiration-library.js';
import { normalizeCreativeRow } from './creative-tracker.js';
export const importSourceKey = (row) => JSON.stringify([row.kind,row.sourceProductId,row.sourceId]);
export function crossProductSources(product, inspirations, queue, ads, deleted, destinationRows) {
  const existing = (kind,id,url) => destinationRows.some((row) => {
    const fields=row.editFields || {};
    return (fields._sourceProductId===product.id && fields[kind==='winner'?'_sourceAdId':'_sourceInsId']===id)
      || (!!url && row.sourceUrl?.replace(/[/#]+$/g,'')===url.replace(/[/#]+$/g,''));
  });
  const sources=projectInspirationLibrary(product.id,inspirations,queue,[],[],[]).filter((row)=>!row.queueOnly).map((row)=>({
    kind:'inspiration',sourceProductId:product.id,sourceProductName:product.name || product.id,sourceId:row.id,version:row.version,
    name:row.formatName,brand:row.brand,angle:row.angle,persona:row.persona,hook:row.hookType,structure:row.creativeStructure,funnel:row.funnelStage,
    status:row.status,createdAt:row.createdAt,sourceUrl:row.sourceUrl,briefUrl:row.briefUrl,
    disabled:!row.version || !['saved','classified','approved','testing','winner','mild winner','scale','loser','killed'].includes(row.status.toLowerCase()),
    existing:existing('inspiration',row.id,row.sourceUrl),
  }));
  const tombstones=new Set(deleted.filter((row)=>row.product_id===product.id).flatMap((row)=>[row.id,row.clickup_task_id]).filter(Boolean));
  for(const raw of ads) {
    const ad=normalizeCreativeRow(raw);
    if(ad.productId!==product.id || ad.parentAdId || ad.deletedAt || ad.productBoundaryQuarantined || tombstones.has(ad.id) || tombstones.has(ad.clickupTaskId)
      || !['winner','mild winner','scale'].includes(ad.status.toLowerCase())) continue;
    const sourceUrl=inspirationLink(ad.adLink);
    sources.push({kind:'winner',sourceProductId:product.id,sourceProductName:product.name || product.id,sourceId:ad.id,version:ad.version,
      name:ad.formatName || ad.id,brand:product.name || product.id,angle:ad.angle,persona:ad.persona,hook:ad.hookType,structure:ad.creativeStructure,funnel:ad.funnelStage,
      status:ad.status,createdAt:ad.createdAt,sourceUrl,briefUrl:inspirationLink(raw.meta?._clickupDocPageUrl || raw.meta?._sourceInspirationBriefUrl),disabled:!ad.version,existing:existing('winner',ad.id,sourceUrl)});
  }
  return sources;
}
export function crossImportRequest(productId, rows, requestId=crypto.randomUUID()) {
  if(!productId || !rows.length || rows.length>50 || new Set(rows.map(importSourceKey)).size!==rows.length) throw new Error('Choose 1 to 50 unique sources.');
  if(rows.some((row)=>row.disabled || row.existing || !row.version || !row.sourceId || !row.sourceProductId || row.sourceProductId===productId || !['inspiration','winner'].includes(row.kind))) throw new Error('Choose available sources from other products.');
  return {p_product_id:productId,p_request_id:requestId,p_items:rows.map(({kind,sourceProductId,sourceId,version})=>({kind,sourceProductId,sourceId,version})).sort((a,b)=>importSourceKey(a).localeCompare(importSourceKey(b)))};
}
