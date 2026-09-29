import { inspirationLink } from './inspiration-library.js';

export function inspirationContext(productId, rows, products, snapshots) {
  const names = new Map(products.map((product) => [product.id,product.name || product.id]));
  const allowed = new Set(names.keys());
  const sources = new Map(snapshots.filter((row) => allowed.has(row.product_id) && !row.deleted_at).map((row) => [JSON.stringify([row.product_id,row.id]),row]));
  const reuseBySource=new Map();
  for(const copy of sources.values()) {
    if(copy.product_id===productId || copy.data?._sourceProductId!==productId || !copy.data?._sourceInsId)continue;
    const group=reuseBySource.get(copy.data._sourceInsId) || new Set();group.add(copy.product_id);reuseBySource.set(copy.data._sourceInsId,group);
  }
  return Object.fromEntries(rows.map((row) => {
    const reused = reuseBySource.get(row.id) || new Set();
    const data=row.editFields || {};
    const source=sources.get(JSON.stringify([data._sourceProductId,data._sourceInsId]));
    return [row.id,{products:[...reused].sort().map((id)=>({id,name:names.get(id)})),
      inheritedBriefUrl:inspirationLink(source?.data?._clickupDocPageUrl || source?.data?.briefUrl),
      inheritedBrief:source?.data?._classificationBrief || null}];
  }));
}

export function clickUpDocumentUrl(value) {
  const url=inspirationLink(value);
  if(!url)return '';
  const parsed=new URL(url);
  return parsed.protocol==='https:' && parsed.hostname==='app.clickup.com' && (/^\/\d+\/v\/dc\/[^/]+/.test(parsed.pathname)||/^\/[^/]+\/docs\/[^/]+/.test(parsed.pathname))?url:'';
}

export function findClickUpBrief(task, comments=[]) {
  const texts=[task?.description,task?.text_content,...(task?.custom_fields || []).map((field)=>field.value),
    ...comments.flatMap((comment)=>[comment.comment_text,...(comment.comment || []).map((part)=>part.text)])];
  for(const text of texts) {
    if(typeof text!=='string')continue;
    for(const candidate of text.match(/https:\/\/app\.clickup\.com\/[^\s"'<>\])]+/g)||[]) {
      const url=clickUpDocumentUrl(candidate);if(url)return url;
    }
  }
  return '';
}
