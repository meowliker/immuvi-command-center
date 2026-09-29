export function serveLegacyHtml(name) {
  if (!['main', 'actionPlan', 'v2'].includes(name)) {
    return Response.json({ error: 'unknown legacy html route' }, { status: 404 });
  }
  // Preserve old bookmarks without executing the legacy startup or external writers.
  return new Response(null, { status: 307, headers: { Location: '/', 'Cache-Control': 'no-store' } });
}
