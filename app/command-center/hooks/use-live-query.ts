'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLiveQuery } from '../../../lib/services/live-query.js';
import { getLiveSync } from '../../../lib/services/live-sync.js';

export type RefreshOptions = { background?: boolean; notice?: string };
type Options = {
  supabase: SupabaseClient;
  productId: string;
  tables: string[];
  enabled?: boolean;
  scopeKey?: string;
  load: (signal: AbortSignal, options: RefreshOptions) => Promise<() => void>;
  onMutationError?: (message: string) => void;
  onMutationEnd?: () => void;
};

export function useLiveQuery(options: Options) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef(options);
  useLayoutEffect(() => { latest.current = options; });
  const { supabase, productId, enabled = true, scopeKey = productId } = options;
  const tablesKey = JSON.stringify([...options.tables].sort());
  const sync = useMemo(() => getLiveSync(supabase), [supabase]);
  const query = useMemo(() => createLiveQuery({
    load: (signal: AbortSignal, request: RefreshOptions) => latest.current.load(signal, request),
    onBusy: setBusy,
    onError: setError,
  }), [sync, scopeKey, tablesKey]);
  const mounted = useRef(false);
  const queued = useRef(new Set<AbortController>());

  useEffect(() => {
    if (!enabled) return;
    mounted.current = true;
    query.start();
    const unwatch = sync.watch({
      productId, tables: JSON.parse(tablesKey),
      invalidate: query.invalidate, pause: query.setPaused,
    });
    void query.refresh();
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') query.invalidate();
    };
    // Catch missed events and tables that have not joined the realtime publication yet.
    const interval = window.setInterval(refreshVisible, 30_000);
    window.addEventListener('focus', refreshVisible);
    window.addEventListener('online', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      mounted.current = false;
      for (const request of queued.current) request.abort();
      queued.current.clear();
      query.dispose();
      unwatch();
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshVisible);
      window.removeEventListener('online', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, [enabled, productId, query, sync, tablesKey]);

  function mutate<Args extends unknown[]>(operation: (...args: Args) => Promise<unknown>) {
    return async (...args: Args) => {
      const event = args[0] as { preventDefault?: () => void } | undefined;
      event?.preventDefault?.();
      if (!mounted.current) return;
      const request = new AbortController();
      queued.current.add(request);
      let finish: (() => void) | undefined;
      try {
        finish = await sync.acquireWrite(productId, request.signal);
        queued.current.delete(request);
        if (request.signal.aborted || !mounted.current) return;
        await operation(...args);
      } catch (cause) {
        if (mounted.current && !request.signal.aborted) latest.current.onMutationError?.(cause instanceof Error ? cause.message : 'Could not save changes.');
      } finally {
        queued.current.delete(request);
        if (mounted.current && !request.signal.aborted) latest.current.onMutationEnd?.();
        finish?.();
      }
    };
  }

  return { refresh: query.refresh, busy, error, mutate };
}
