const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const reject = () => { throw Object.assign(new Error('Invalid account creation request. Check email, names, role, products and password (8-72 UTF-8 bytes).'), { definite: true }); };
export function validateAccountCreation(value) {
  if (!value || !uuid.test(value.requestId) || typeof value.email !== 'string' || value.email.length > 320
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) || value.email !== value.email.trim().toLowerCase()
    || typeof value.username !== 'string' || value.username.length < 1 || value.username.length > 100 || value.username !== value.username.trim()
    || typeof value.fullName !== 'string' || value.fullName.length > 200 || value.fullName !== value.fullName.trim()
    || !['admin','member'].includes(value.role) || !['generated','custom'].includes(value.passwordMode)
    || !Array.isArray(value.productIds) || value.productIds.length > 1000
    || value.productIds.some((id) => typeof id !== 'string' || !id || id.length > 200 || id !== id.trim())
    || new Set(value.productIds).size !== value.productIds.length || (value.role === 'admin' && value.productIds.length)
    || Object.keys(value).some((key) => !['requestId','email','username','fullName','role','productIds','passwordMode','tempPassword'].includes(key))) reject();
  if (value.tempPassword !== undefined && (value.passwordMode !== 'custom' || typeof value.tempPassword !== 'string'
    || new TextEncoder().encode(value.tempPassword).length < 8 || new TextEncoder().encode(value.tempPassword).length > 72)) reject();
  return value;
}
export function creationRecoveryRequest(request) {
  validateAccountCreation(request);
  const { tempPassword, ...safe } = request;
  return safe;
}
export function verifyAccountCreation(result, request) {
  if (result?.state !== 'completed' || result.requestId !== request.requestId || !uuid.test(result.userId)
    || result.operation !== 'create-user' || result.email !== request.email || result.dispatchEnabled !== false
    || typeof result.credentialsAvailable !== 'boolean' || (result.user !== null && (result.user?.id !== result.userId
      || !/^[a-f0-9]{32}$/.test(result.user.access_revision || '')))
    || (result.credentialsAvailable && (!result.user || typeof result.temp_password !== 'string' || result.temp_password.length < 8))
    || (!result.credentialsAvailable && result.temp_password !== undefined)) throw new Error('Account creation could not be verified. Recover the pending request.');
  return result;
}
