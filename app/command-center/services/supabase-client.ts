import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseClientCache = new Map<string, SupabaseClient>();

export function getSupabaseBrowserClient(supabaseUrl: string, supabaseAnonKey: string) {
  const cacheKey = `${supabaseUrl}:${supabaseAnonKey}`;
  const cached = supabaseClientCache.get(cacheKey);
  if (cached) return cached;
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0] || 'default';
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storageKey: `immuvi-auth-${projectRef}`,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  supabaseClientCache.set(cacheKey, client);
  return client;
}
