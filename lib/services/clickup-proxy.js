const CLICKUP_API_BASE = 'https://api.clickup.com/api';

export function buildClickUpProxyTarget(requestUrl) {
  const url = new URL(requestUrl, 'http://localhost');
  const path = url.searchParams.get('path') || '';
  const apiVersion = url.searchParams.get('v') === '3' ? 'v3' : 'v2';

  if (!path || !path.startsWith('/')) {
    throw new Error('Missing or invalid ?path= parameter (must start with /)');
  }

  const passthrough = new URLSearchParams();
  for (const [key, value] of url.searchParams) {
    if (key !== 'path' && key !== 'v') passthrough.append(key, value);
  }

  const query = passthrough.toString();
  return `${CLICKUP_API_BASE}/${apiVersion}${path}${query ? `?${query}` : ''}`;
}

export function clickUpProxyCorsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };
}

export function clickUpForwardHeaders(headers) {
  const auth = headers.authorization || headers.Authorization || '';
  if (!auth) {
    throw new Error('Missing Authorization header (ClickUp personal token)');
  }

  return {
    Authorization: auth,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}
