import { getSupabaseServerEnv } from "@/lib/env/server";

type RestOptions = {
  headers?: Record<string, string>;
  method?: string;
  prefer?: string;
  body?: unknown;
};

export class SupabaseRestError extends Error {
  status: number;
  detail: string;

  constructor(message: string, status: number, detail: string) {
    super(message);
    this.name = "SupabaseRestError";
    this.status = status;
    this.detail = detail;
  }
}

export async function supabaseRest<T>(path: string, options: RestOptions = {}) {
  const { url, serviceRoleKey } = getSupabaseServerEnv();
  const headers: Record<string, string> = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (options.prefer) headers.Prefer = options.prefer;

  const response = await fetch(`${url}/rest/v1${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();

  if (!response.ok) {
    throw new SupabaseRestError(`Supabase REST ${response.status}`, response.status, text);
  }

  if (!text) return null as T;
  return JSON.parse(text) as T;
}

export async function verifySupabaseUser(accessToken: string) {
  const { url, serviceRoleKey } = getSupabaseServerEnv();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) return null;
  return (await response.json()) as { id?: string; email?: string };
}

