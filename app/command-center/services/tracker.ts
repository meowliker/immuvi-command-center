import type { SupabaseClient } from '@supabase/supabase-js';
import { readProductRows } from '../../../lib/services/product-rows.js';
import { normalizeCreativeRow } from '../../../lib/domain/creative-tracker.js';
import { requestQaClickUp } from './qa-clickup';

export async function loadTrackerData(db: SupabaseClient, productId: string, signal: AbortSignal) {
  const ads = await readProductRows(db, 'ads', productId, signal);
  const tombstones=await readProductRows(db,'deleted_ads',productId,signal);
  const cells = await readProductRows(db, 'matrix_cells', productId, signal);
  const angles = await readProductRows(db, 'angles', productId, signal);
  const personas = await readProductRows(db, 'personas', productId, signal);
  const deleted=new Set(tombstones.flatMap((row)=>[row.id,row.clickup_task_id]).filter(Boolean));
  const visible = ads.filter((ad) => ad.product_id===productId && !ad.deleted_at && !ad.meta?._productBoundaryQuarantined && !deleted.has(ad.id) && !deleted.has(ad.clickup_task_id || ad.meta?.clickupTaskId || ad.meta?._clickupId));
  const winners = await loadWinningFiles(db, visible.map((ad) => ad.id), signal);
  return { creatives: visible.map((ad) => ({ ...normalizeCreativeRow(ad), winningArtifacts: winners[ad.id] || [] })), cells, angles, personas };
}

export async function loadWinningFiles(db: SupabaseClient, adIds: string[], signal: AbortSignal) {
  const winners: Record<string, { id: string; name: string; url: string }[]> = {};
  for (let start = 0; start < adIds.length; start += 100) {
    const ids = adIds.slice(start, start + 100);
    for (let offset = 0; ; offset += 500) {
      const result = await db.from('task_video_winners').select('*').in('ad_id', ids).order('id').range(offset, offset + 499).abortSignal(signal);
      if (result.error) throw new Error('Winning files could not be loaded.');
      for (const row of result.data || []) {
        if (ids.includes(row.ad_id) && typeof row.drive_file_id === 'string' && /^[\w-]+$/.test(row.drive_file_id)) {
          (winners[row.ad_id] ||= []).push({ id: row.drive_file_id, name: row.file_name || row.drive_file_id, url: row.web_view_url });
        }
      }
      if ((result.data?.length || 0) < 500) break;
    }
  }
  return winners;
}

export async function trackerRpc(db: SupabaseClient, name: string, args: Record<string, unknown>) {
  const result = await db.rpc(name, args);
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function pushTrackerCreative(db: SupabaseClient, productId: string, adId: string) {
  try {
    const result = await requestQaClickUp(db, productId, { operation: 'push-creative', adId });
    return result.failed?.length
      ? `${result.pushed} ClickUp fields updated. Pending: ${result.failed.map((item: { field: string; error: string }) => `${item.field}: ${item.error}`).join('; ')}`
      : `${result.pushed} ClickUp fields updated.`;
  } catch (cause) {
    return `Saved in QA. ClickUp changes remain pending: ${cause instanceof Error ? cause.message : 'Request failed.'}`;
  }
}
