'use client';
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Creative } from '../types';
import { normalizeCreativeRow } from '../../../lib/domain/creative-tracker.js';
import { loadWinningFiles } from '../services/tracker';
import { useLiveQuery } from '../hooks/use-live-query';
import { useTrackerActions } from '../hooks/use-tracker-actions';
import { TrackerWinners } from './tracker-winners';
import styles from '../../command-center.module.css';

export function PlanWinningArtifacts({ db, productId, adId, disabled, onBusy }: {
  db: SupabaseClient; productId: string; adId: string; disabled: boolean; onBusy: (busy: boolean) => void;
}) {
  const [creative, setCreative] = useState<Creative | null>(null);
  const [error, setError] = useState('');
  const actions = useTrackerActions(db, productId, setCreative);
  const live = useLiveQuery({ supabase: db, productId, scopeKey: `${productId}:${adId}:winners`, tables: ['ads'], load,
    onMutationError: setError, onMutationEnd: () => actions.setBusyAction('') });
  const saving = !!actions.busyAction;
  useEffect(() => { onBusy(saving); return () => onBusy(false); }, [saving, onBusy]);
  async function load(signal: AbortSignal) {
    const result = await db.from('ads').select('*').eq('product_id', productId).eq('id', adId).is('deleted_at', null).abortSignal(signal).single();
    if (result.error || !result.data || result.data.product_id !== productId) throw new Error('Winning creative is unavailable.');
    const files = await loadWinningFiles(db, [adId], signal);
    return () => setCreative({ ...normalizeCreativeRow(result.data), winningArtifacts: files[adId] || [] });
  }
  return <>
    {error || live.error ? <p role="alert" className={styles.error}>{error || live.error}</p> : null}
    {actions.notice ? <p role="status">{actions.notice}</p> : null}
    {live.error ? <button type="button" disabled={live.busy || saving} onClick={live.refresh}>Retry winning files</button> : null}
    {!creative && !live.error ? <p role="status">Loading winning files...</p> : null}
    {creative ? <TrackerWinners db={db} creative={creative} busy={disabled || saving || !!live.error}
      save={live.mutate(async (...args: Parameters<typeof actions.winner>) => { setError(''); actions.setNotice(''); await actions.winner(...args); })}
      share={live.mutate(async (...args: Parameters<typeof actions.shareWinner>) => { setError(''); actions.setNotice(''); await actions.shareWinner(...args); })} /> : null}
  </>;
}
