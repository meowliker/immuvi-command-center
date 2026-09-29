'use client';
import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validateTaxonomyRequest } from '../../../lib/domain/taxonomy-mutations.js';
import { mutateTaxonomy } from '../../../lib/services/taxonomy-mutations.js';
import type { TaxonomyKind } from '../types';

export function useTaxonomyWrite(db: SupabaseClient, userId: string, productId: string, kind: TaxonomyKind) {
  const key = `immuvi:qa:taxonomy:${userId}:${productId}:${kind}`;
  const [pending, setPending] = useState<ReturnType<typeof validateTaxonomyRequest> | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(false);
  const lock = useRef(false);
  useEffect(() => {
    active.current = true;
    try {
      const value = sessionStorage.getItem(key);
      if (value) {
        const request = validateTaxonomyRequest(JSON.parse(value));
        if (request.p_product_id !== productId || request.p_kind !== kind) throw new Error('Saved taxonomy request belongs to another scope.');
        setPending(request);
      }
      setReady(true);
    } catch { setError('Saved taxonomy recovery data could not be read. No new changes can be sent from this session.'); }
    return () => { active.current = false; };
  }, [key, kind, productId]);

  async function submit(request: ReturnType<typeof validateTaxonomyRequest>) {
    if (!ready || lock.current) return null;
    if (pending && JSON.stringify(pending) !== JSON.stringify(request)) throw new Error('Recover the pending taxonomy request before starting another change.');
    lock.current = true;
    try {
      sessionStorage.setItem(key, JSON.stringify(request));
      setPending(request); setError('');
      const saved = await mutateTaxonomy(db, request);
      sessionStorage.removeItem(key);
      if (!active.current) return null;
      setPending(null);
      return saved;
    } catch (cause) {
      if ((cause as { definite?: boolean }).definite) {
        sessionStorage.removeItem(key);
        if (active.current) setPending(null);
      }
      if (active.current) setError(cause instanceof Error ? cause.message : 'Taxonomy save failed.');
      return null;
    } finally { lock.current = false; }
  }
  return { pending, ready, error, submit };
}
