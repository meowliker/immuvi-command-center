// Browser-only fixtures. SQL and service tests exercise the real workflow contracts.
exports.stage=function stage(data,input) {
  const ad=data.ads.find((a) => a.id===input.p_ad_id && a.product_id===input.p_product_id);
  if (!ad || ad.deleted_at || ad.meta?._productBoundaryQuarantined || (input.p_expected_updated_at && ad.updated_at !== input.p_expected_updated_at)) throw new Error('Creative changed. Refresh before adding to Action Plan.');
  let action=data.manual_actions.find((a) => (a.payload.sourceAdId || a.payload.adId)===ad.id);
  if(!action) {
    action={id:`plan-${ad.id}`,product_id:ad.product_id,live_status:ad.status,updated_at:new Date().toISOString(),payload:{sourceAdId:ad.id,title:ad.format_name,
      sourceAngle:ad.angle,sourcePersona:ad.persona,description:ad.meta.notes || '',dueDate:ad.meta.dueDate || '', _clickupId:ad.clickup_task_id || ad.meta?._clickupId || ad.meta?.clickupTaskId || null}};
    data.manual_actions.push(action);
  }
  return action;
};
exports.push=function push(data,input,control) {
  const ad=data.ads.find((a) => a.id===input.adId && a.product_id===input.productId);
  const action=exports.stage(data,{p_ad_id:ad.id,p_product_id:ad.product_id});
  let job=data.qa_clickup_creations.find((j) => j.ad_id===ad.id);
  if(!job) {
    job={id:`creation-${ad.id}`,ad_id:ad.id,product_id:ad.product_id,state:'sending',last_error:null};data.qa_clickup_creations.push(job);
    control.creationPosts=(control.creationPosts || 0)+1;
    if(control.creationFailure) {job.state='uncertain';job.last_error='Creation outcome is uncertain. Recover the existing task.';return {error:'ClickUp may have created the task. Use Recover ClickUp link.'};}
  }
  ad.clickup_task_id='qa-created-task';ad.meta._clickupId='qa-created-task';
  action.payload._clickupId='qa-created-task';action.payload.clickupTaskId='qa-created-task';
  job.state='linked';job.last_error=null;
  return {state:'linked',taskId:'qa-created-task'};
};
exports.edit=function edit(data,input) {
  const ad=data.ads.find((a) => a.id===input.p_ad_id && a.product_id===input.p_product_id),action=data.manual_actions.find((a) => a.id===input.p_action_id && a.product_id===input.p_product_id);
  if (!ad || !action || ad.deleted_at || ad.updated_at !== input.p_ad_updated_at || action.updated_at !== input.p_expected_updated_at) return { code: 'P0001', message: 'Task changed. Refresh before editing.' };
  if ((action.payload.sourceAdId || action.payload.adId || action.payload._sourceAdId) !== ad.id) return { code: 'P0001', message: 'Action Plan source identity is unresolved' };
  if(input.p_status!==null) {ad.status=input.p_status;ad.last_status_change_at=Date.now();action.live_status=input.p_status;action.payload.liveStatus=input.p_status;}
  else {
    const values={dueDate:input.p_due_date,_dueDateMs:input.p_due_date ? Date.parse(`${input.p_due_date}T23:59:59Z`) : null};
    Object.assign(ad.meta,values);Object.assign(action.payload,values);
  }
  ad.updated_at=new Date().toISOString();action.updated_at=ad.updated_at;
  return {ad,action};
};
