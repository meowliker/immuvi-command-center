import type { SupabaseClient } from '@supabase/supabase-js';

const keyFor = (userId: string) => `immuvi:qa:entgcnlfsnysnwyadzzp:clickup:${userId}`;

export function qaLiveSyncPreference(userId: string) {
  try { return window.localStorage.getItem(`${keyFor(userId)}:live-sync`) !== 'false'; } catch { return true; }
}

export function storeQaLiveSyncPreference(userId: string, enabled: boolean) {
  try { window.localStorage.setItem(`${keyFor(userId)}:live-sync`, String(enabled)); } catch { /* Keep the choice for this mounted session. */ }
}

export function qaClickUpToken(userId: string) {
  try { return window.sessionStorage.getItem(keyFor(userId)) || ''; } catch { return ''; }
}

export function storeQaClickUpToken(userId: string, token: string) {
  if (token.trim()) window.sessionStorage.setItem(keyFor(userId), token.trim());
  else window.sessionStorage.removeItem(keyFor(userId));
}

export async function requestQaClickUp(
  supabase: SupabaseClient, productId: string, input: Record<string, unknown>, signal?: AbortSignal,
) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Sign in to QA first.');
  const token = qaClickUpToken(data.session.user.id);
  if (!token) throw new Error('Enter a ClickUp key in the QA connection controls.');
  const response = await fetch('/api/clickup/qa', {
    method: 'POST', signal,
    headers: { Authorization: `Bearer ${data.session.access_token}`, 'X-ClickUp-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, productId }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) throw new Error(body.error || `ClickUp request failed (${response.status}).`);
  return body;
}
