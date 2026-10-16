const failure=(status,error,code)=>({status,body:{error,code}});

export async function deleteOrphanAction({fetchImpl,url,headers,requestSignal,adId,productId,
  expectedClickUpId,actionId,confirmOrphanAction=false}) {
  const response=await fetchImpl(url+'/rest/v1/rpc/delete_orphan_action',{
    method:'POST',headers,signal:requestSignal(),body:JSON.stringify({
      p_product_id:productId,p_source_ad_id:adId,p_expected_clickup_id:expectedClickUpId,
      p_action_id:actionId||null,p_confirm:confirmOrphanAction===true
    })
  });
  const result=await response.json();
  if(!response.ok) {
    const code=String(result?.code||'DATABASE_ERROR');
    const status=response.status===401?401:code==='42501'?403:code==='P0002'?404:code==='PT409'?409:503;
    return failure(status,status===401?'Your session expired. Please sign in again.':
      status===403?'You do not have access to delete in this product.':
      status===404?'No saved creative or Action Plan entry matches this task. Refresh before deleting.':
      status===409?'This Action Plan entry changed or has conflicting identities. Refresh before deleting.':
      'The Action Plan deletion could not be confirmed. Refresh before retrying.',code);
  }
  const expectedIds=expectedClickUpId?[expectedClickUpId]:[];
  if(result.id!==adId||result.productId!==productId||
    typeof result.actionId!=='string'||!result.actionId||
    (actionId&&result.actionId!==actionId)||
    result.markerId!=='orphan-action:'+productId+':'+result.actionId||
    JSON.stringify(result.clickupTaskIds)!==JSON.stringify(expectedIds)) {
    return failure(409,'The saved Action Plan identity could not be verified.','IDENTITY_CONFLICT');
  }
  if(!confirmOrphanAction&&!result.alreadyDeleted) {
    if(result.preview!==true||result.deletedAt) return failure(502,'The Action Plan preview could not be verified.','VERIFY_FAILED');
    return {status:409,body:{error:'This Action Plan entry has no saved creative in this product. Confirm removal of only this stale entry.',
      code:'ORPHAN_ACTION_CONFIRMATION_REQUIRED',preview:result}};
  }
  if(!result.deletedAt) return failure(502,'The Action Plan deletion could not be verified.','VERIFY_FAILED');
  const markerQuery=new URLSearchParams({id:'eq.'+result.markerId,product_id:'eq.'+productId,
    select:'id,product_id,clickup_task_id,deleted_at'});
  const markerResponse=await fetchImpl(url+'/rest/v1/deleted_ads?'+markerQuery,{headers,signal:requestSignal()});
  const markers=await markerResponse.json();
  const actionQuery=new URLSearchParams({id:'eq.'+result.actionId,product_id:'eq.'+productId,select:'id'});
  const actionResponse=await fetchImpl(url+'/rest/v1/manual_actions?'+actionQuery,{headers,signal:requestSignal()});
  const actions=await actionResponse.json();
  if(!markerResponse.ok||!Array.isArray(markers)||markers.length!==1||
    markers[0].id!==result.markerId||markers[0].product_id!==productId||
    (markers[0].clickup_task_id||null)!==(expectedClickUpId||null)||
    Date.parse(markers[0].deleted_at)!==Date.parse(result.deletedAt)||
    !actionResponse.ok||!Array.isArray(actions)||actions.length!==0) {
    return failure(502,'The Action Plan deletion could not be verified. Refresh before retrying.','VERIFY_FAILED');
  }
  return {status:200,body:{...result,kind:'orphan_action',skipClickUpDelete:true,verified:true}};
}
