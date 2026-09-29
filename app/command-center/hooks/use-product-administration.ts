'use client';
import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validateProductAdminRequest } from '../../../lib/domain/product-administration.js';
import { mutateProduct } from '../../../lib/services/product-administration.js';
import { getLiveSync } from '../../../lib/services/live-sync.js';

export function useProductAdministration(db: SupabaseClient, userId: string) {
  const key = `immuvi:qa:product-admin:${userId}`;
  const [pending, setPending] = useState<ReturnType<typeof validateProductAdminRequest> | null>(null);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const mounted = useRef(false), lock = useRef(false);
  useEffect(() => {
    mounted.current = true;
    try { const value = sessionStorage.getItem(key); if (value) setPending(validateProductAdminRequest(JSON.parse(value))); setReady(true); }
    catch { setError('Saved product recovery data could not be read. New product changes are blocked.'); }
    return () => { mounted.current = false; };
  }, [key]);
  async function submit(request: ReturnType<typeof validateProductAdminRequest>) {
    if (!ready || lock.current) return false;
    if (pending && JSON.stringify(pending) !== JSON.stringify(request)) { setError('Recover the pending product request first.'); return false; }
    const finish = getLiveSync(db).beginWrite('');
    if (!finish) { setError('Another change is still being saved.'); return false; }
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      sessionStorage.setItem(key, JSON.stringify(request)); setPending(request);
      await mutateProduct(db, request);
      sessionStorage.removeItem(key);
      if (!mounted.current) return false;
      setPending(null); setNotice(`Product ${request.p_operation} saved in QA.`); return true;
    } catch (cause) {
      if ((cause as { definite?: boolean }).definite) { sessionStorage.removeItem(key); if (mounted.current) setPending(null); }
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Product save failed.');
      return false;
    } finally { lock.current = false; if (mounted.current) setBusy(false); finish(); }
  }
  return { submit, pending, ready, busy, error, notice };
}
