'use client';

import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertQaClickUpList } from '../../../lib/domain/clickup-sync.js';
import { productClickUpListId } from '../../../lib/domain/product-config.js';
import { trackerBulkSelection } from '../../../lib/domain/tracker-bulk-push.js';
import { getLiveSync } from '../../../lib/services/live-sync.js';
import { qaClickUpToken, requestQaClickUp } from '../services/qa-clickup';
import type { Creative, Product } from '../types';

type Result = { id: string; title: string; pushed: number; error: string };
export function useTrackerPushAll(db: SupabaseClient, product: Product | undefined, creatives: Creative[]) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const controller = useRef<AbortController | null>(null);
  const listId = product ? productClickUpListId(product) : '';
  useEffect(() => {
    setBusy(false); setError(''); setNotice(''); setResults([]);
    return () => { controller.current?.abort(); controller.current = null; };
  }, [product?.id, listId]);

  async function pushAll() {
    if (controller.current || !product) return;
    let activeRequest: AbortController | null = null;
    setError(''); setNotice(''); setResults([]);
    try {
      assertQaClickUpList(listId);
      const { items, skipped } = trackerBulkSelection(creatives, product.id);
      if (!items.length) { setNotice('No linked creatives with fields to push.'); return; }
      if (!window.confirm(`Push structure, hook, production style, angle, persona and funnel stage for all ${items.length} linked creatives to the QA ClickUp list? Current filters do not limit this operation. ${skipped} creatives will be skipped. No tasks will be created.`)) return;
      const finish = getLiveSync(db).beginWrite(product.id);
      if (!finish) throw new Error('A product change is still being saved. Try again shortly.');
      const request = new AbortController(); activeRequest = request; controller.current = request; setBusy(true);
      const completed: Result[] = [];
      try {
        const session = await db.auth.getSession();
        request.signal.throwIfAborted();
        if (session.error || !session.data.session) throw new Error('Sign in to QA first.');
        if (!qaClickUpToken(session.data.session.user.id)) throw new Error('Save a ClickUp key through the QA connection controls first.');
        for (const item of items) {
          if (request.signal.aborted) break;
          setNotice(`Pushing ${completed.length + 1} of ${items.length} creatives...`);
          try {
            const result = await requestQaClickUp(db, product.id, { operation: 'push-all-creative-fields', adId: item.id,
              expectedUpdatedAt: item.version, expectedTaskId: item.taskId }, request.signal);
            if (result.adId !== item.id || result.taskId !== item.taskId || !Number.isSafeInteger(result.pushed) || result.pushed < 0 || !Array.isArray(result.failed)) throw new Error('Incomplete push acknowledgement. Verify ClickUp before retrying.');
            completed.push({ id: item.id, title: item.title, pushed: result.pushed, error: result.failed.map((entry: { field: string; error: string }) => `${entry.field}: ${entry.error}`).join('; ') });
          } catch (cause) {
            completed.push({ id: item.id, title: item.title, pushed: 0, error: request.signal.aborted ? 'Stopped during request. Some fields may have reached ClickUp; verify before retrying.' : cause instanceof Error ? cause.message : 'Push failed.' });
          }
          if (controller.current === request) setResults([...completed]);
        }
        const attention = completed.filter((item) => item.error).length;
        if (controller.current === request) setNotice(`${request.signal.aborted ? 'Stopped. ' : ''}${completed.reduce((n, item) => n + item.pushed, 0)} ClickUp fields updated; ${attention} ${attention === 1 ? 'creative needs' : 'creatives need'} attention; ${skipped + items.length - completed.length} skipped.`);
      } finally {
        if (controller.current === request) { controller.current = null; setBusy(false); }
        finish();
      }
    } catch (cause) { if (!activeRequest?.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not push creatives.'); }
  }
  return { busy, error, notice, results, pushAll, stop: () => controller.current?.abort() };
}
