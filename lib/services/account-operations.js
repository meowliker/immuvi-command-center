import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { validateAccountRequest } from '../domain/account-operations.js';
import { QA_SUPABASE_URL } from '../qa-supabase-env.js';

function key(secret) { return createHash('sha256').update(`immuvi-qa-account-v1:${secret}`).digest(); }
export function sealAccountPassword(password, secret, requestId) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  cipher.setAAD(Buffer.from(requestId));
  const data = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64url')).join('.');
}
export function openAccountPassword(value, secret, requestId) {
  const [iv, tag, data] = value.split('.').map((part) => Buffer.from(part, 'base64url'));
  const cipher = createDecipheriv('aes-256-gcm', key(secret), iv);
  cipher.setAAD(Buffer.from(requestId)); cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8');
}
function failure(message, definite = false) { return Object.assign(new Error(message), { definite }); }
export async function runAccountOperation({ db, actorId, request, secretKey }) {
  validateAccountRequest(request);
  if (db.supabaseUrl?.replace(/\/$/, '') !== QA_SUPABASE_URL || !secretKey) throw failure('Account operations require the approved QA configuration.', true);
  const { requestId, ...input } = request, token = randomUUID();
  const encrypted = request.operation === 'reset-password' ? sealAccountPassword(`Qa9!${randomBytes(18).toString('base64url')}`, secretKey, requestId) : null;
  const prepared = await db.rpc('qa_account_prepare', { p_actor: actorId, p_request_id: requestId, p_input: input, p_send_token: token, p_secret_cipher: encrypted });
  if (prepared.error) throw failure(/^(P0001|22|23|42501)/.test(prepared.error.code || '') ? prepared.error.message : 'Account request could not be recorded. Recover the same request.', /^(P0001|22|23|42501)/.test(prepared.error.code || ''));
  const job = prepared.data;
  if (!job || job.request_id !== requestId || job.target_id !== request.userId || job.actor_id !== actorId || job.operation !== request.operation
    || typeof job.canSend !== 'boolean' || !['sending','completed','rejected'].includes(job.state)) throw failure('Account request acknowledgement could not be verified.');
  if (job.state === 'rejected') throw failure('Auth rejected this request. Refresh the account before submitting a new request.', true);
  async function reject(message) {
    const result = await db.rpc('qa_account_reject', { p_actor: actorId, p_request_id: requestId, p_send_token: token });
    if (result.error) throw failure('Account rejection could not be recorded. Recover the pending request.');
    throw failure(message, true);
  }
  let authError;
  if (job.canSend && job.state === 'sending') {
    // Read failures happen before any Auth write and can safely release this reservation.
    let user;
    try { const found = await db.auth.admin.getUserById(request.userId); if (found.error) throw found.error; user = found.data.user; }
    catch { return reject('Auth account could not be inspected. No Auth change was sent.'); }
    if (user?.id !== request.userId) return reject('Auth returned an unexpected account. No Auth change was sent.');
    let password;
    if (request.operation === 'reset-password') {
      try { password = openAccountPassword(job.secret_cipher, secretKey, requestId); }
      catch { return reject('Reset credential could not be opened. No Auth change was sent.'); }
    }
    try {
      const result = request.operation === 'delete-user'
        ? await db.auth.admin.deleteUser(request.userId)
        : await db.auth.admin.updateUserById(request.userId, {
          app_metadata: { ...user.app_metadata, qa_account_request: requestId },
          ...(request.operation === 'reset-password' ? { password } : { ban_duration: request.operation === 'deactivate' ? '876600h' : 'none' }),
        });
      authError = result.error;
    } catch (error) { authError = error; }
  }
  // Retries only reconcile the durable Auth state; they never repeat a claimed Auth write.
  const finished = await db.rpc('qa_account_finish', { p_actor: actorId, p_request_id: requestId });
  if (finished.error) throw failure('Auth may have changed the account, but local confirmation failed. Recover this request.');
  const result = finished.data;
  if (result?.state !== 'completed' || result.requestId !== requestId || result.userId !== request.userId || result.operation !== request.operation) {
    if (job.canSend && [400,401,403,422].includes(authError?.status)) return reject('Auth rejected this account change. Refresh and review before trying again.');
    throw failure('Account outcome is not confirmed. Recover this request; no new Auth change will be sent.');
  }
  if (result.credentialsAvailable) {
    try { return { ...result, temp_password: openAccountPassword(job.secret_cipher, secretKey, requestId) }; }
    catch { throw failure('Account reset completed, but its credential cannot be opened with the current QA key. Restore the original encryption key to recover it.'); }
  }
  return result;
}
