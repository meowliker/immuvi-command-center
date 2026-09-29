const { randomUUID } = require('node:crypto');
const adminAccess = require('./admin-access-fixture.cjs');
module.exports = function (data, input, control) {
  (control.creationCalls ||= []).push(structuredClone(input));
  const jobs = control.creationJobs ||= new Map(); const { tempPassword, ...safe } = input;
  let job = jobs.get(input.requestId);
  if (!job) {
    if (data.profiles_with_products.some((row) => row.email === input.email)) return { error: 'An account with this email already exists', definite: true };
    if (input.productIds.some((id) => !data.products.some((row) => row.id === id))) return { error: 'An assigned product is unavailable. Refresh and review.', definite: true };
    job = { input: safe, id: randomUUID(), password: tempPassword || 'fixture-generated-creation-password' }; jobs.set(input.requestId, job);
    control.authCreationWrites = (control.authCreationWrites || 0) + 1;
  }
  if (JSON.stringify(job.input) !== JSON.stringify(safe)) return { error: 'Creation request identity conflicts', definite: true };
  if (control.creationUncertain) return { error: 'Account creation is not confirmed. Recover this request.', definite: false };
  if (!job.result) {
    data.profiles_with_products.push({ ...data.profiles_with_products[0], id: job.id, email: input.email, username: input.username, full_name: input.fullName,
      role: input.role, is_active: true, must_change_password: true, product_ids: input.productIds, last_login_at: null });
    job.result = { state: 'completed', operation: 'create-user', requestId: input.requestId, userId: job.id, email: input.email, dispatchEnabled: false,
      user: adminAccess.page(data).find((row) => row.id === job.id), credentialsAvailable: true, temp_password: job.password };
    (data.account_audit ||= []).unshift({ id: String(2000 + jobs.size), action: 'qa_account_create_user', createdAt: new Date().toISOString(), actorId: data.profiles[0].id, targetId: job.id, email: input.email });
  }
  return structuredClone(job.result);
};
