import { checkpointArguments } from '../domain/action-plan-checkpoint.js';

export async function savePlanCheckpoint(db, productId, action, decision, pushRemote) {
  const { data, error } = await db.rpc('qa_plan_checkpoint', checkpointArguments(productId, action, decision));
  if (error) throw new Error(error.message);
  let message = decision === 'snooze' ? 'Testing snoozed for seven days in QA.' : `Testing decision saved in QA: ${decision}.`;
  if (decision !== 'snooze' && pushRemote && (data.ad.clickup_task_id || data.ad.meta?._clickupId || data.ad.meta?.clickupTaskId)) {
    try {
      const result = await pushRemote({ operation: 'push-creative', adId: data.ad.id, actionId: data.action.id });
      if (result.failed?.length) message += ` ClickUp pending: ${result.failed.map((item) => `${item.field}: ${item.error}`).join('; ')}`;
      else message += ' ClickUp updated.';
    } catch (cause) { message += ` ClickUp pending: ${cause instanceof Error ? cause.message : 'Request failed.'}`; }
  }
  return { ...data, message };
}
