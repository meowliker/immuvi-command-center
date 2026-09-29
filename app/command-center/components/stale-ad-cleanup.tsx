'use client';
import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '../types';
import { TrackerDialog } from './tracker-dialog';
import { qaClickUpToken } from '../services/qa-clickup';
import { getLiveSync } from '../../../lib/services/live-sync.js';
import { CLEANUP_LIST, validateCleanupRequest, verifyCleanupPreview, verifyCleanupReceipt } from '../../../lib/domain/stale-ad-cleanup.js';
import styles from '../../command-center.module.css';

type Commit = { operation: 'commit'; productId: string; previewId: string; requestId: string; confirmName: string };
type Preview = { productId: string; previewId: string; productName: string; expiresAt: string; remoteCount: number; candidates: { id: string; name: string; taskId: string }[]; protected: Record<string, number> };
export function StaleAdCleanup({ db, product, userId, disabled }: { db: SupabaseClient; product: Product; userId: string; disabled: boolean }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [ready, setReady] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [confirmName, setConfirmName] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null), [pending, setPending] = useState<Commit | null>(null);
  const mounted = useRef(false), lock = useRef(false);
  const key = `immuvi:qa:stale-cleanup:${userId}:${product.id}`;
  useEffect(() => {
    mounted.current = true;
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) { const request = validateCleanupRequest(JSON.parse(saved)); if (request.operation !== 'commit' || request.productId !== product.id) throw new Error(); setPending(request); }
      setReady(true);
    } catch { setError('Cleanup recovery data could not be read. New cleanup is blocked.'); }
    return () => { mounted.current = false; };
  }, [key, product.id]);
  async function run(input: { operation: 'preview'; productId: string } | Commit) {
    if (!ready || lock.current || disabled || (pending && JSON.stringify(pending) !== JSON.stringify(input))) return;
    const finish = getLiveSync(db).beginWrite(product.id);
    if (!finish) { setError('Another product change is still being saved.'); return; }
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      validateCleanupRequest(input);
      if (input.operation === 'commit') { sessionStorage.setItem(key, JSON.stringify(input)); setPending(input); }
      const { data, error: sessionError } = await db.auth.getSession();
      if (sessionError || data.session?.user.id !== userId) throw new Error('Sign in with the original QA administrator.');
      const response = await fetch('/api/clickup/qa-cleanup', { method: 'POST',
        headers: { Authorization: `Bearer ${data.session.access_token}`, 'X-ClickUp-Token': qaClickUpToken(userId), 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw Object.assign(new Error(result?.error || 'Cleanup response was interrupted.'), { definite: result?.definite === true });
      if (input.operation === 'preview') {
        verifyCleanupPreview(result, product.id);
        if (mounted.current) { setPreview(result); setConfirmName(''); }
      } else {
        verifyCleanupReceipt(result, input); sessionStorage.removeItem(key);
        if (mounted.current) { setPending(null); setPreview(null); setConfirmName(''); setNotice(`Removed ${result.deletedIds.length} stale creatives from QA. ClickUp tasks and taxonomy were unchanged.`); }
      }
    } catch (cause) {
      if ((cause as { definite?: boolean }).definite && input.operation === 'commit') {
        try { sessionStorage.removeItem(key); if (mounted.current) setPending(null); }
        catch { if (mounted.current) setReady(false); }
      }
      if (mounted.current) { setPreview(null); setError(cause instanceof Error ? cause.message : 'Cleanup failed.'); }
    } finally { lock.current = false; if (mounted.current) setBusy(false); finish(); }
  }
  return <>
    <button type="button" disabled={disabled || !ready || (!pending && product.clickupListId !== CLEANUP_LIST)} onClick={() => setOpen(true)}><span aria-hidden="true">🧹</span>{pending ? 'Recover stale-ad cleanup' : 'Clean stale'}</button>
    {!open && error && <p role="alert">{error}</p>}
    {open && <TrackerDialog title="Clean stale ads" className={styles.legacyProductDialog} closeLabel="Close stale-ad cleanup" busy={busy} error={error} onClose={() => setOpen(false)}>
      <div className={styles.productAdminForm}>
        <p><strong>{product.name}</strong></p>
        {notice && <p role="status">{notice}</p>}
        {pending ? <p role="status">Cleanup confirmation is pending for {pending.confirmName}.</p> : <button type="button" disabled={busy || disabled} onClick={() => void run({ operation: 'preview', productId: product.id })}>{preview ? 'Refresh cleanup preview' : 'Preview stale ads'}</button>}
        {preview && <>
          <p>{preview.remoteCount} current and archived ClickUp tasks verified. {preview.candidates.length} stale creatives selected.</p>
          <dl className={styles.productDeleteCounts}>{Object.entries(preview.protected).map(([reason, count]) => <div key={reason}><dt>Kept: {reason}</dt><dd>{count}</dd></div>)}</dl>
          <ul className={styles.staleCleanupList}>{preview.candidates.map((ad) => <li key={ad.id}><strong>{ad.name}</strong><span>{ad.id}</span></li>)}</ul>
          <p>Only the listed local creatives will be soft-deleted. ClickUp tasks and taxonomy will not be changed.</p>
          {!!preview.candidates.length && <label>Type product name<input autoComplete="off" disabled={busy} value={confirmName} onChange={(event) => setConfirmName(event.target.value)} /></label>}
        </>}
        <footer><button type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
          <button type="button" disabled={busy || disabled || (!pending && (!preview?.candidates.length || confirmName !== preview.productName || Date.parse(preview.expiresAt) <= Date.now()))}
            onClick={() => void run(pending || { operation: 'commit', productId: product.id, previewId: preview!.previewId, requestId: crypto.randomUUID(), confirmName })}>
            {busy ? 'Checking...' : pending ? 'Recover cleanup' : 'Remove stale creatives'}
          </button></footer>
      </div>
    </TrackerDialog>}
  </>;
}
