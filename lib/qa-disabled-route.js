// Compatibility endpoints must not bypass native QA authorization/destination gates.
export function qaDisabledRoute() {
  return Response.json({
    error: 'This legacy integration is disabled in QA. Use the command center at / and its guarded QA workflows.',
    code: 'QA_INTEGRATION_DISABLED',
    dispatchEnabled: false,
  }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
