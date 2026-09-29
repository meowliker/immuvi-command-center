import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { assertQaClickUpList } from '../domain/clickup-sync.js';
import { buildCreationPayload, matchesCreation } from '../domain/clickup-creation.js';
import { runClickUpCreation, completeClaimedCreation, creationMediaKind } from './clickup-creation.js';

const taskIds = (ad) => [ad.clickup_task_id, ad.meta?._clickupId, ad.meta?.clickupTaskId].filter(Boolean);
const sourceId = (action) => action?.payload?.sourceAdId || action?.payload?.adId || action?.payload?._sourceAdId;

export async function repairPlanClickUp({ db, clickup, product, listId, input, signal }) {
  assertQaClickUpList(listId);
  if (!input.adId || !/^[a-zA-Z0-9_-]+$/.test(input.oldTaskId || '') || !input.adVersion) throw new Error('Reopen the task before repairing its link.');
  async function read(table, column, id) {
    const result = await db.from(table).select('*').eq('product_id', product.id).eq(column, id).maybeSingle();
    if (result.error) throw new Error(`Could not verify ${table}. No replacement was sent.`);
    return result.data;
  }
  const ad = await read('ads', 'id', input.adId);
  if (!ad || ad.product_id !== product.id || ad.deleted_at || ad.meta?._productBoundaryQuarantined) throw new Error('Creative is unavailable.');
  const action = input.actionId ? await read('manual_actions', 'id', input.actionId) : null;
  if (input.actionId && (!action || action.product_id !== product.id || sourceId(action) !== ad.id || action.payload?._productBoundaryQuarantined)) throw new Error('Action Plan source identity changed.');
  const job = await read('qa_clickup_creations', 'ad_id', ad.id);
  const currentTask = taskIds(ad)[0] || '';
  // A retry after prepare/POST/finalize uncertainty must reuse the same generation.
  if (currentTask !== input.oldTaskId && ad.meta?._qaRecreateFromTaskId === input.oldTaskId
    && job?.id === ad.meta?._qaRecreationJobId && job.product_id === product.id && job.ad_id === ad.id) {
    return { ...await runClickUpCreation({ db, clickup, product, listId, input: { adId: ad.id, actionId: action?.id, recoveryTaskId: input.recoveryTaskId } }), mode: 'recreated' };
  }
  if (ad.updated_at !== input.adVersion || (action && action.updated_at !== input.actionVersion)) throw new Error('Task changed. Close and reopen the repair dialog.');
  const ids = [...taskIds(ad), action?.payload?._clickupId, action?.payload?.clickupTaskId].filter(Boolean);
  if (!ids.length || ids.some((id) => id !== input.oldTaskId)) throw new Error('ClickUp task identity changed.');
  if (job && (job.product_id !== product.id || job.ad_id !== ad.id || !['linked', 'rejected'].includes(job.state)
    || (job.state === 'linked' && job.remote_task_id !== input.oldTaskId))) throw new Error('Recover or resolve the existing creation job before repairing this link.');
  let remote = null;
  try { remote = await clickup.getTask(listId, input.oldTaskId); }
  catch (cause) { if (cause.status !== 404) throw cause; }
  if (remote && String(remote.id) !== input.oldTaskId) throw new Error('Remote task identity could not be verified.');
  if (!remote) {
    const tasks = await clickup.tasks(listId, { includeArchived: true });
    if (tasks.some((task) => String(task.id) === input.oldTaskId)) throw new Error('The task is still listed in ClickUp. Retry verification; nothing was recreated.');
    const matches = job?.state === 'linked' ? tasks.filter((task) => matchesCreation(task, job)) : [];
    if (matches.length > 1) throw new Error('Multiple recovery markers found. Resolve duplicates before recreating.');
    if (matches.length === 1) {
      remote = await clickup.getTask(listId, String(matches[0].id));
      if (String(remote.id) !== String(matches[0].id) || !matchesCreation(remote, job)) throw new Error('Recovery marker changed. Nothing was relinked.');
    } else if (tasks.some((task) => String(task.name || '').trim().toLowerCase() === ad.format_name.trim().toLowerCase())) {
      throw new Error('A same-name task exists without a verified recovery marker. Review it before recreating.');
    }
  }
  if (remote && (String(remote.list?.id) !== listId || !/^[a-zA-Z0-9_-]+$/.test(String(remote.id)))) throw new Error('Remote task identity could not be verified.');
  const id = randomUUID(), token = randomUUID();
  const payload = remote ? null : buildCreationPayload({ ad, action: action || { product_id: product.id, payload: { sourceAdId: ad.id } },
    product, schema: await clickup.inspect(listId), jobId: id, mediaKind: await creationMediaKind(db,product.id,ad) });
  signal?.throwIfAborted();
  const result = await db.rpc('qa_plan_repair', { p_product_id: product.id, p_ad_id: ad.id, p_ad_updated_at: input.adVersion,
    p_action_id: action?.id || null, p_action_updated_at: action?.updated_at || null, p_product_updated_at: product.updated_at,
    p_old_task_id: input.oldTaskId, p_new_task_id: remote ? String(remote.id) : null,
    p_prior_job_id: job?.id || null, p_job_id: id, p_token: token, p_payload: payload });
  if (result.error) throw new Error(result.error.message);
  const saved = result.data;
  if (saved?.ad?.id !== ad.id || saved.ad.product_id !== product.id || saved?.action?.product_id !== product.id || sourceId(saved.action) !== ad.id) throw new Error('Repair acknowledgment could not be verified. Refresh before retrying.');
  if (remote) {
    if (saved.ad.clickup_task_id !== String(remote.id) || saved.action.payload._clickupId !== String(remote.id)) throw new Error('Repaired task identity could not be verified.');
    return { state: 'linked', taskId: String(remote.id), mode: 'relinked' };
  }
  const claimed = saved.job;
  if (claimed?.id !== id || claimed.product_id !== product.id || claimed.ad_id !== ad.id || claimed.action_id !== saved.action.id
    || claimed.state !== 'sending' || claimed.list_id !== listId || claimed.lease_token !== token || !isDeepStrictEqual(claimed.payload, payload)) throw new Error('Recreation claim could not be verified. Recover before retrying; no task was sent.');
  return { ...await completeClaimedCreation({ db, clickup, product, input, job: claimed, token }), mode: 'recreated' };
}
