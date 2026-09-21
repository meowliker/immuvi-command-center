export const automaticDeletionReason = 'trigger:collapse_local_dup_on_sync';

export function planDuplicateVisibility(snapshot, verified) {
  const products = new Map(snapshot.products.map(row=>[row.id,row]));
  const ads = new Map(snapshot.ads.map(row=>[row.id,row]));
  const repairs = [], skipped = [];
  for (const marker of snapshot.markers) {
    if (marker.deleted_by!==automaticDeletionReason) continue;
    const existing = ads.get(marker.id);
    // Legacy short AD IDs were reused across products. Never mutate that other row.
    const duplicate = existing?.product_id===marker.product_id ? existing : null;
    const taskId = marker.clickup_task_id || duplicate?.clickup_task_id || duplicate?.superseded_task;
    if (!taskId || (!marker.clickup_task_id && !duplicate?.clickup_task_id)) continue;
    const canonical = ads.get(taskId), product = products.get(marker.product_id), remote = verified[taskId];
    const item = {productId:marker.product_id,product:product?.name,duplicateId:marker.id,
      taskId,task:canonical?.format_name || remote?.name || taskId};
    let reason;
    if (marker.id===taskId) reason='Marker targets canonical row';
    else if (snapshot.markers.some(row=>row.product_id===marker.product_id &&
      (row.id===taskId || row.clickup_task_id===taskId) && row.deleted_by!==automaticDeletionReason)) reason='Separate deletion intent must be preserved';
    else if (!canonical || canonical.product_id!==marker.product_id || canonical.deleted_at) reason='No live same-product canonical task';
    else if (canonical.clickup_task_id!==taskId) reason='Canonical row points to a different ClickUp task';
    else if (duplicate && (duplicate.clickup_task_id && duplicate.clickup_task_id!==taskId || duplicate.superseded_by && duplicate.superseded_by!==taskId)) reason='Duplicate identity conflict';
    else if (duplicate && !duplicate.deleted_at) reason='Local row was revived; requires review';
    else if (!remote || remote.error || remote.id!==taskId) reason='ClickUp verification unavailable';
    else if (remote.archived) reason='ClickUp task archived';
    else if (!product?.list_id || remote.listId!==product.list_id) reason='ClickUp product/list mismatch';
    else if (canonical.source_list && canonical.source_list!==remote.listId) reason='Stored source list conflicts with ClickUp';
    if (reason) { skipped.push({...item,reason}); continue; }
    repairs.push({...item,hasDuplicate:!!duplicate,foreignIdReused:!!existing&&!duplicate,
      normalizeRouting:!!canonical.sync_product && canonical.sync_product!==product.id,
      listId:remote.listId});
  }
  return {repairs,skipped};
}

export function remapCell(cell, replacements) {
  const result = structuredClone(cell);
  result.creative_assignments = [...new Set((cell.creative_assignments || []).map(id=>replacements.get(id) || id))];
  if (result.meta?.per_ad && typeof result.meta.per_ad==='object' && !Array.isArray(result.meta.per_ad)) {
    for (const [oldId,newId] of replacements) {
      if (!Object.hasOwn(result.meta.per_ad,oldId)) continue;
      result.meta.per_ad[newId] = {...result.meta.per_ad[oldId],...result.meta.per_ad[newId]};
      delete result.meta.per_ad[oldId];
    }
  }
  return result;
}

export function remapAction(action, replacements) {
  const result = structuredClone(action);
  for (const key of ['sourceAdId','_sourceAdId','adId']) {
    if (replacements.has(result.payload?.[key])) result.payload[key]=replacements.get(result.payload[key]);
  }
  return result;
}
