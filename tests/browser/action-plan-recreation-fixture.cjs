// UI-only fixture; service and SQL suites verify the remote checks and atomic claim.
module.exports = function repair(data, input, control) {
  const ad = data.ads.find((a) => a.id === input.adId && a.product_id === input.productId);
  let action = data.manual_actions.find((a) => (a.payload.sourceAdId || a.payload.adId) === input.adId);
  const outcome = control.repairOutcomes?.[ad.id] || 'existing';
  if (outcome === 'error') return { error: 'ClickUp verification failed. No replacement was sent.' };
  const job = data.qa_clickup_creations.find((j) => j.ad_id === ad.id);
  const resume = job?.state === 'uncertain' && ad.meta._qaRecreateFromTaskId === input.oldTaskId;
  if (!resume && (ad.updated_at !== input.adVersion || (input.actionId && action.updated_at !== input.actionVersion))) return { error: 'Task changed. Close and reopen the repair dialog.' };
  if (!action) {
    action = { id: `repair-${ad.id}`, product_id: ad.product_id, live_status: ad.status, updated_at: ad.updated_at, payload: { sourceAdId: ad.id, title: ad.format_name } };
    data.manual_actions.push(action);
  }
  if (outcome === 'uncertain' && !resume) {
    ad.meta._qaRecreateFromTaskId = input.oldTaskId; ad.clickup_task_id = null;
    delete ad.meta._clickupId; delete action.payload._clickupId;
    ad.meta._clickupTaskDeleted = false; action.payload._clickupTaskDeleted = false;
    data.qa_clickup_creations.push({ id: `repair-job-${ad.id}`, product_id: ad.product_id, ad_id: ad.id, state: 'uncertain', last_error: 'Lost create response' });
    control.repairPosts = (control.repairPosts || 0) + 1;
    return { error: 'ClickUp may have created the task. Recover the existing link; no second create will be sent.' };
  }
  const taskId = outcome === 'existing' ? input.oldTaskId : `repaired-${ad.id}`;
  if (outcome === 'replacement') control.repairPosts = (control.repairPosts || 0) + 1;
  Object.assign(ad, { clickup_task_id: taskId, updated_at: new Date().toISOString() });
  Object.assign(ad.meta, { _clickupId: taskId, _clickupTaskDeleted: false });
  Object.assign(action.payload, { _clickupId: taskId, clickupTaskId: taskId, _clickupTaskDeleted: false });
  action.updated_at = ad.updated_at;
  if (job) job.state = 'linked';
  return { state: 'linked', taskId, mode: outcome === 'replacement' || resume ? 'recreated' : 'relinked' };
};
