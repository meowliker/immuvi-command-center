'use client';
import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useLiveQuery } from '../hooks/use-live-query';
import styles from '../../command-center.module.css';
import { RefreshCw } from 'lucide-react';

type Audit = { id: string; action: string; createdAt: string; actorId: string | null; targetId: string | null; email: string | null };
export function AccountAudit({ db }: { db: SupabaseClient }) {
  const [pages, setPages] = useState(1), [rows, setRows] = useState<Audit[]>([]), [more, setMore] = useState(false);
  const { refresh, busy, error } = useLiveQuery({ supabase: db, productId: '', scopeKey: `account-audit:${pages}`, tables: ['admin_audit_log'],
    async load(signal) {
      const all: Audit[] = []; let cursor: string | null = null, hasMore = false;
      for (let page = 0; page < pages; page++) {
        const result = await db.rpc('qa_account_audit_page', { p_before: cursor }).abortSignal(signal);
        if (result.error || !Array.isArray(result.data) || result.data.length > 50) throw new Error('Account activity could not be loaded.');
        for (const row of result.data as Audit[]) {
          if (!/^[1-9]\d*$/.test(row.id) || (cursor && BigInt(row.id) >= BigInt(cursor)) || typeof row.action !== 'string'
            || !Number.isFinite(Date.parse(row.createdAt))) throw new Error('Account activity response could not be verified.');
          all.push(row); cursor = row.id;
        }
        hasMore = result.data.length === 50;
        if (!hasMore) break;
      }
      return () => { setRows(all); setMore(hasMore); };
    },
  });
  return <section className={styles.accountAudit} aria-label="Account activity">
    <header><h2>Account activity</h2><button type="button" aria-label="Refresh activity" title="Refresh activity" disabled={busy} onClick={() => void refresh()}><RefreshCw size={16} /></button></header>
    {error && <p role="alert">{error}</p>}
    {!rows.length && <p>{busy ? 'Loading activity...' : error ? 'Activity unavailable.' : 'No account activity recorded.'}</p>}
    <ol>{rows.map((row) => <li key={row.id}><strong>{row.action.replace(/^qa_(account|user)_/, '').replaceAll('_', ' ')}</strong>
      <span>{row.email || row.targetId || 'Account unavailable'}</span><time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString()}</time></li>)}</ol>
    {more && <button type="button" disabled={busy || !!error} onClick={() => setPages((value) => value + 1)}>Load earlier activity</button>}
  </section>;
}
