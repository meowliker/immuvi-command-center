import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { creationRecoveryRequest, validateAccountCreation, verifyAccountCreation } from '../domain/account-creation.js';
import { sealAccountPassword, openAccountPassword } from './account-operations.js';
import { QA_SUPABASE_URL } from '../qa-supabase-env.js';

const failure = (message, definite = false) => Object.assign(new Error(message), { definite });
export async function runAccountCreation({ db, actorId, request, secretKey }) {
  validateAccountCreation(request);
  if (db.supabaseUrl?.replace(/\/$/, '') !== QA_SUPABASE_URL || !secretKey) throw failure('Account creation requires approved QA configuration.', true);
  const { requestId, ...input } = creationRecoveryRequest(request), token = randomUUID();
  const password = request.passwordMode === 'generated' ? `Qa9!${randomBytes(18).toString('base64url')}` : request.tempPassword;
  const prepared = await db.rpc('qa_account_creation_prepare', { p_actor: actorId, p_request_id: requestId, p_input: input,
    p_target: randomUUID(), p_send_token: token, p_secret_cipher: password ? sealAccountPassword(password, secretKey, requestId) : null,
    p_password_tag: request.tempPassword === undefined ? null : createHmac('sha256', secretKey).update(`${requestId}:${password}`).digest('hex') });
  if (prepared.error) throw failure(/^(P0001|22|23|42501)/.test(prepared.error.code || '') ? prepared.error.message : 'Creation could not be recorded. Recover the same request.', /^(P0001|22|23|42501)/.test(prepared.error.code || ''));
  const job = prepared.data;
  if (!job || job.request_id !== requestId || job.actor_id !== actorId || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(job.target_id || '')
    || typeof job.canSend !== 'boolean' || !['sending','completed','rejected'].includes(job.state)) throw failure('Creation reservation could not be verified.');
  if (job.state === 'rejected') throw failure('Creation was rejected. Review the form before submitting a new request.', true);
  async function reject(message) {
    const result = await db.rpc('qa_account_creation_reject', { p_actor: actorId, p_request_id: requestId, p_send_token: token });
    if (result.error) throw failure('Creation rejection could not be confirmed. Recover the pending request.');
    throw failure(message, true);
  }
  let authError;
  if (job.canSend && job.state === 'sending') {
    let credential;
    try { credential = openAccountPassword(job.secret_cipher, secretKey, requestId); }
    catch { return reject('Creation credential could not be opened. No Auth change was sent.'); }
    try {
      const result = await db.auth.admin.createUser({ id: job.target_id, email: input.email, password: credential, email_confirm: true,
        user_metadata: { username: input.username, full_name: input.fullName },
        app_metadata: { qa_creation_request: requestId, role: 'member', must_change_password: true } });
      authError = result.error;
    } catch (error) { authError = error; }
  }
  // Only the first reservation dispatches. Recovery verifies the original UUID and trusted marker.
  const finished = await db.rpc('qa_account_creation_finish', { p_actor: actorId, p_request_id: requestId });
  if (finished.error) throw failure('Auth may have created the account, but provisioning is unconfirmed. Recover the same request.');
  let result = finished.data;
  if (result?.state !== 'completed') {
    if (job.canSend && [400,401,403,422].includes(authError?.status)) return reject('Auth rejected account creation. Check the email and password before trying again.');
    throw failure('Account creation is not confirmed. Recover this request; a second Auth account will not be sent.');
  }
  if (result.userId !== job.target_id) throw failure('Creation result does not match the reserved account. Recover the pending request.');
  if (result.credentialsAvailable) {
    try { result = { ...result, temp_password: openAccountPassword(job.secret_cipher, secretKey, requestId) }; }
    catch { throw failure('Account was created, but its credential needs the original QA encryption key to recover.'); }
  }
  return verifyAccountCreation(result, request);
}
