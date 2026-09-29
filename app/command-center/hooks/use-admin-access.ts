'use client';
import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { mutateAdminAccess, validateAdminAccessRequest } from '../../../lib/services/admin-access.js';
import { getLiveSync } from '../../../lib/services/live-sync.js';

export type AccessRequest = { p_request_id: string; p_user_id: string; p_operation: 'products' | 'role'; p_revision: string; p_values: { productIds?: string[]; role?: string } };
export function useAdminAccess(db: SupabaseClient, userId: string, saved: (row: Record<string, unknown>, request: AccessRequest) => void) {
  const key = `immuvi:qa:admin-access:${userId}`;
  const [pending, setPending] = useState<AccessRequest | null>(null);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const mounted = useRef(false), lock = useRef(false);
  useEffect(() => {
    mounted.current = true;
    try { const value = sessionStorage.getItem(key); if (value) setPending(validateAdminAccessRequest(JSON.parse(value))); setReady(true); }
    catch { setError('Saved access recovery data could not be read. New user changes are blocked.'); }
    return () => { mounted.current = false; };
  }, [key]);
  async function submit(request: AccessRequest) {
    if (!ready || lock.current) return;
    if (pending && JSON.stringify(pending) !== JSON.stringify(request)) { setError('Retry the pending access request first.'); return; }
    const finish = getLiveSync(db).beginWrite('');
    if (!finish) { setError('Another change is still being saved.'); return; }
    lock.current = true; setBusy(true); setError('');
    let sent = false;
    try {
      validateAdminAccessRequest(request);
      sessionStorage.setItem(key, JSON.stringify(request)); setPending(request);
      sent = true;
      const result = await mutateAdminAccess(db, request);
      sessionStorage.removeItem(key);
      if (mounted.current) { setPending(null); saved(result.user, request); }
    } catch (cause) {
      if ((!sent && !pending) || (cause as { definite?: boolean }).definite) {
        try { sessionStorage.removeItem(key); if (mounted.current) setPending(null); }
        catch { if (mounted.current) setReady(false); }
      }
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'User access save failed.');
    } finally { lock.current = false; if (mounted.current) setBusy(false); finish(); }
  }
  return { submit, pending, ready, busy, error };
}
