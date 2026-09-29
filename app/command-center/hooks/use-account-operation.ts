'use client';
import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validateAccountRequest, verifyAccountResult } from '../../../lib/domain/account-operations.js';
import { getLiveSync } from '../../../lib/services/live-sync.js';

export type AccountRequest = { requestId: string; userId: string; operation: 'reset-password' | 'deactivate' | 'reactivate' | 'delete-user'; revision: string; confirmEmail: string };
export function useAccountOperation(db: SupabaseClient, userId: string, saved: (result: Record<string, any>) => void) {
  const key = `immuvi:qa:account-operation:${userId}`;
  const [pending, setPending] = useState<AccountRequest | null>(null), [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const mounted = useRef(false), lock = useRef(false);
  useEffect(() => {
    mounted.current = true;
    try { const stored = sessionStorage.getItem(key); if (stored) setPending(validateAccountRequest(JSON.parse(stored))); setReady(true); }
    catch { setError('Account recovery data could not be read. New account changes are blocked.'); }
    return () => { mounted.current = false; };
  }, [key]);
  async function submit(request: AccountRequest) {
    if (!ready || lock.current) return false;
    if (pending && JSON.stringify(pending) !== JSON.stringify(request)) { setError('Recover the pending account operation first.'); return false; }
    const finish = getLiveSync(db).beginWrite('');
    if (!finish) { setError('Another change is still being saved.'); return false; }
    lock.current = true; setBusy(true); setError('');
    try {
      validateAccountRequest(request);
      sessionStorage.setItem(key, JSON.stringify(request)); setPending(request);
      const { data, error: sessionError } = await db.auth.getSession();
      if (sessionError || !data.session || data.session.user.id !== userId) throw new Error('Sign in with the original administrator to recover this request.');
      const response = await fetch(`/api/admin/${request.operation}`, { method: 'POST',
        headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw Object.assign(new Error(result?.error || 'Account response was interrupted. Recover this request.'), { definite: result?.definite === true });
      verifyAccountResult(result, request);
      sessionStorage.removeItem(key);
      if (mounted.current) { setPending(null); saved(result); return true; }
      return false;
    } catch (cause) {
      if ((cause as { definite?: boolean }).definite) {
        try { sessionStorage.removeItem(key); if (mounted.current) setPending(null); }
        catch { if (mounted.current) setReady(false); }
      }
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Account operation failed.');
      return false;
    } finally { lock.current = false; if (mounted.current) setBusy(false); finish(); }
  }
  return { submit, pending, ready, busy, error };
}
