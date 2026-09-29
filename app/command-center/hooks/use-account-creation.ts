'use client';
import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { creationRecoveryRequest, verifyAccountCreation } from '../../../lib/domain/account-creation.js';
import { getLiveSync } from '../../../lib/services/live-sync.js';

type CreationRequest = { requestId: string; email: string; username: string; fullName: string; role: 'admin' | 'member'; productIds: string[]; passwordMode: 'generated' | 'custom'; tempPassword?: string };
export function useAccountCreation(db: SupabaseClient, userId: string, saved: (result: Record<string, any>) => void) {
  const key = `immuvi:qa:account-creation:${userId}`;
  const [pending, setPending] = useState<CreationRequest | null>(null), [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const mounted = useRef(false), lock = useRef(false);
  useEffect(() => {
    mounted.current = true;
    try { const stored = sessionStorage.getItem(key); if (stored) setPending(creationRecoveryRequest(JSON.parse(stored))); setReady(true); }
    catch { setError('Creation recovery data could not be read. New account changes are blocked.'); }
    return () => { mounted.current = false; };
  }, [key]);
  async function submit(request: CreationRequest) {
    if (!ready || lock.current) return false;
    let safe: CreationRequest;
    try { safe = creationRecoveryRequest(request); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Invalid account request.'); return false; }
    if (pending && JSON.stringify(pending) !== JSON.stringify(safe)) { setError('Recover the pending account creation first.'); return false; }
    const finish = getLiveSync(db).beginWrite('');
    if (!finish) { setError('Another change is still being saved.'); return false; }
    lock.current = true; setBusy(true); setError('');
    try {
      sessionStorage.setItem(key, JSON.stringify(safe)); setPending(safe);
      const { data, error: sessionError } = await db.auth.getSession();
      if (sessionError || !data.session || data.session.user.id !== userId) throw new Error('Sign in with the original administrator to recover creation.');
      const response = await fetch('/api/admin/create-user', { method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw Object.assign(new Error(result?.error || 'Creation response was interrupted. Recover this request.'), { definite: result?.definite === true });
      verifyAccountCreation(result, safe);
      sessionStorage.removeItem(key);
      if (mounted.current) { setPending(null); saved(result); return true; }
      return false;
    } catch (cause) {
      if ((cause as { definite?: boolean }).definite) {
        try { sessionStorage.removeItem(key); if (mounted.current) setPending(null); }
        catch { if (mounted.current) setReady(false); }
      }
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Creation failed.');
      return false;
    } finally { lock.current = false; if (mounted.current) setBusy(false); finish(); }
  }
  return { submit, pending, ready, busy, error };
}
