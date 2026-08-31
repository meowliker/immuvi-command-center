export function requireSupabaseServiceConfig(env = process.env) {
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '');

  if (!url || !serviceKey) {
    throw new Error('missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return { url, serviceKey };
}

export function supabaseServiceHeaders(serviceKey, extra = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

export function buildSupabaseApiUrl(baseUrl, prefix, path) {
  const normalizedBase = String(baseUrl || '').replace(/\/+$/, '');
  const normalizedPrefix = String(prefix || '').replace(/^\/?/, '/').replace(/\/+$/, '');
  const normalizedPath = String(path || '').replace(/^\/?/, '/');
  return `${normalizedBase}${normalizedPrefix}${normalizedPath}`;
}

export function postgrestIn(values) {
  return (values || [])
    .map((value) => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    .join(',');
}

async function parseResponseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function supabaseRestRequest(method, path, body, options = {}) {
  const { env = process.env, fetchImpl = fetch, prefer } = options;
  const { url, serviceKey } = requireSupabaseServiceConfig(env);
  const headers = supabaseServiceHeaders(serviceKey);
  if (prefer) headers.Prefer = prefer;

  const response = await fetchImpl(buildSupabaseApiUrl(url, '/rest/v1', path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const parsed = await parseResponseBody(response);

  if (!response.ok) {
    throw new Error(`Supabase ${method} ${path} failed: HTTP ${response.status} ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`);
  }

  return parsed;
}

export async function supabaseAuthRequest(method, path, body, options = {}) {
  const { env = process.env, fetchImpl = fetch } = options;
  const { url, serviceKey } = requireSupabaseServiceConfig(env);

  const response = await fetchImpl(buildSupabaseApiUrl(url, '/auth/v1', path), {
    method,
    headers: supabaseServiceHeaders(serviceKey),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const parsed = await parseResponseBody(response);

  if (!response.ok) {
    throw new Error(`Supabase ${method} ${path} failed: HTTP ${response.status} ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`);
  }

  return parsed || {};
}
