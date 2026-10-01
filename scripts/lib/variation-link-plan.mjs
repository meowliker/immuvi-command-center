export function planVariationLinks(products, ads, tombstones) {
  const byId=new Map(ads.map(a=>[a.id,a]));
  const byProduct=new Map(products.map(p=>[p.id,p]));
  const deleted=new Set(tombstones.flatMap(t=>[t.product_id+'|id|'+t.id,...(t.clickup_task_id?[t.product_id+'|cu|'+t.clickup_task_id]:[])]));
  const owners=new Map();
  for(const a of ads)if(a.clickup_task_id&&!a.deleted_at) {
    if(!owners.has(a.clickup_task_id))owners.set(a.clickup_task_id,new Set());
    owners.get(a.clickup_task_id).add(a.product_id);
  }
  const protectedRow=a=>a.deleted_at||a.quarantined===true||a.quarantined==='true'||deleted.has(a.product_id+'|id|'+a.id)||deleted.has(a.product_id+'|cu|'+a.clickup_task_id);
  const pairs=[],skipped=[],seen=new Set();
  for(const child of ads.filter(a=>a.parent_ad_id&&!a.deleted_at)) {
    const parent=byId.get(child.parent_ad_id),product=byProduct.get(child.product_id);
    let reason='';
    if(protectedRow(child))reason='protected-deletion-or-quarantine';
    else if(!parent)reason='missing-parent-record';
    else if(protectedRow(parent))reason='protected-parent';
    else if(parent.product_id!==child.product_id)reason='cross-product-parent';
    else if(!child.clickup_task_id||!parent.clickup_task_id)reason='not-published-to-clickup';
    else if(child.clickup_task_id===parent.clickup_task_id)reason='self-link';
    else if(!product?.config?.clickup_list_id)reason='missing-product-list';
    else if(owners.get(child.clickup_task_id)?.size>1||owners.get(parent.clickup_task_id)?.size>1)reason='ambiguous-task-ownership';
    else {
      const chain=new Set([child.id]);let next=parent;
      while(next){if(chain.has(next.id)){reason='parent-cycle';break;}chain.add(next.id);next=byId.get(next.parent_ad_id);}
    }
    if(reason){skipped.push({adId:child.id,productId:child.product_id,name:child.format_name,parentAdId:child.parent_ad_id,reason});continue;}
    const key=child.clickup_task_id+'|'+parent.clickup_task_id;
    if(seen.has(key))continue;seen.add(key);
    pairs.push({adId:child.id,parentAdId:parent.id,productId:child.product_id,listId:String(product.config.clickup_list_id),taskId:child.clickup_task_id,parentTaskId:parent.clickup_task_id});
  }
  const targets=new Map();
  for(const pair of pairs){if(!targets.has(pair.taskId))targets.set(pair.taskId,new Set());targets.get(pair.taskId).add(pair.parentTaskId);}
  return {pairs:pairs.filter(p=>{
    if(targets.get(p.taskId).size===1)return true;
    skipped.push({...p,reason:'conflicting-parent-identities'});return false;
  }),skipped};
}

export function relatedTaskIds(task) {
  return (task.linked_tasks||[]).flatMap(link=>String(link.task_id)===String(task.id)?[String(link.link_id)]:String(link.link_id)===String(task.id)?[String(link.task_id)]:[]);
}

export function inspectLivePair(pair,child,parent) {
  if(!child||!parent)return 'missing-clickup-task';
  if(String(child.id)!==pair.taskId||String(parent.id)!==pair.parentTaskId)return 'clickup-identity-mismatch';
  if(child.archived||parent.archived)return 'archived-clickup-task';
  if(String(child.list?.id)!==pair.listId||String(parent.list?.id)!==pair.listId)return 'clickup-list-mismatch';
  if(!Array.isArray(child.linked_tasks)||!Array.isArray(parent.linked_tasks))return 'relationships-unavailable';
  if(relatedTaskIds(child).includes(pair.parentTaskId)&&relatedTaskIds(parent).includes(pair.taskId))return 'linked';
  return 'missing';
}
