const adminAccess = require('./admin-access-fixture.cjs');
module.exports = function (data, input, control) {
  (control.accountCalls ||= []).push(structuredClone(input));
  const jobs = control.accountJobs ||= new Map();
  let job = jobs.get(input.requestId);
  const rejected = (error, definite = true) => ({ error, definite });
  if (!job) {
    const row = data.profiles_with_products.find((item) => item.id === input.userId);
    const snapshot = adminAccess.page(data).find((item) => item.id === input.userId);
    if (!row || snapshot.access_revision !== input.revision) return rejected('User access changed. Refresh and review.');
    if (input.operation === 'delete-user' && input.confirmEmail !== row.email) return rejected('Confirm the exact account email');
    job = { input: structuredClone(input), row, pending: control.accountUncertain || false };
    jobs.set(input.requestId, job); control.authAccountWrites = (control.authAccountWrites || 0) + 1;
    if (input.operation === 'reset-password') row.must_change_password = true;
    else row.is_active = false;
    row.accessGeneration = (row.accessGeneration || 0) + 1;
  }
  if (JSON.stringify(job.input) !== JSON.stringify(input)) return rejected('Account request identity conflicts');
  if (job.pending && !control.resolveAccount) return rejected('Account outcome is not confirmed. Recover this request; no new Auth change will be sent.', false);
  if (!job.result) {
    if (input.operation === 'reactivate') job.row.is_active = true;
    if (input.operation === 'delete-user') data.profiles_with_products = data.profiles_with_products.filter((row) => row.id !== input.userId);
    job.result = { state: 'completed', requestId: input.requestId, userId: input.userId, operation: input.operation, dispatchEnabled: false,
      credentialsAvailable: input.operation === 'reset-password',
      user: input.operation === 'delete-user' ? null : adminAccess.page(data).find((item) => item.id === input.userId),
      ...(input.operation === 'reset-password' ? { temp_password: 'fixture-temporary-password' } : {}) };
    (data.account_audit ||= []).unshift({ id: String(1000 + jobs.size), action: `qa_account_${input.operation.replaceAll('-', '_')}`,
      createdAt: new Date().toISOString(), actorId: data.profiles[0].id, targetId: input.userId, email: job.row.email });
  }
  return structuredClone(job.result);
};
