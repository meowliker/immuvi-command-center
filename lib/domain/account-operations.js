const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
export const ACCOUNT_OPERATIONS = ['reset-password', 'deactivate', 'reactivate', 'delete-user'];
export function validateAccountRequest(value) {
  if (!value || !uuid.test(value.requestId) || !uuid.test(value.userId) || !ACCOUNT_OPERATIONS.includes(value.operation)
    || !/^[a-f0-9]{32}$/.test(value.revision || '') || typeof value.confirmEmail !== 'string' || value.confirmEmail.length > 320
    || Object.keys(value).some((key) => !['requestId','userId','operation','revision','confirmEmail'].includes(key))) {
    throw Object.assign(new Error('Invalid account request.'), { definite: true });
  }
  return value;
}
export function verifyAccountResult(result, request) {
  if (result?.state !== 'completed' || result.requestId !== request.requestId || result.userId !== request.userId
    || result.operation !== request.operation || result.dispatchEnabled !== false || typeof result.credentialsAvailable !== 'boolean'
    || (request.operation === 'delete-user' ? result.user !== null : result.user?.id !== request.userId || !/^[a-f0-9]{32}$/.test(result.user?.access_revision || ''))
    || (request.operation === 'reactivate' && result.user.is_active !== true)
    || (request.operation === 'deactivate' && result.user.is_active !== false)
    || (request.operation === 'reset-password' && result.user.must_change_password !== true)
    || (result.credentialsAvailable && (request.operation !== 'reset-password' || typeof result.temp_password !== 'string' || result.temp_password.length < 12))
    || (!result.credentialsAvailable && result.temp_password !== undefined)) throw new Error('Account result could not be verified. Recover the pending request.');
  return result;
}
