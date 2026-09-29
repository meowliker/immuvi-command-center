import { normalizeActionAd, normalizeManualActionRow, resolveActionDisplay } from '../../../lib/domain/action-plan.js';
import type { ActionRecord, ManualAction } from '../types';
import { objectRecord, textValue } from './values';
import { planLifecycleRows } from '../../../lib/domain/action-plan-visibility.js';

export function buildActionRecords(manualRows: unknown, adRows: unknown, tombstones: unknown[] = []): ActionRecord[] {
  const eligible = planLifecycleRows(Array.isArray(manualRows) ? manualRows.map(objectRecord) : [], Array.isArray(adRows) ? adRows.map(objectRecord) : [], tombstones.map(objectRecord));
  const rawAds: Record<string, unknown>[] = eligible.ads;
  const ads = rawAds.map(normalizeActionAd);
  const rawAdById = new Map(rawAds.map((row) => [JSON.stringify([textValue(row.product_id), textValue(row.id)]), row]));
  if (!Array.isArray(manualRows)) return [];
  return eligible.actions.flatMap((rawRow: Record<string, unknown>) => {
    const row = objectRecord(rawRow);
    const manualAction = normalizeManualActionRow(row) as ManualAction;
    const display = resolveActionDisplay(manualAction, ads.filter((ad) => ad.productId === manualAction.productId));
    if (!display) return [];
    const linkedAdRow = display.linkedAdId ? rawAdById.get(JSON.stringify([manualAction.productId, display.linkedAdId])) : undefined;
    return [{
      display,
      payload: objectRecord(row.payload),
      linkedAdMeta: objectRecord(linkedAdRow?.meta),
      actionVersion: textValue(row.updated_at),
      adVersion: textValue(linkedAdRow?.updated_at),
    }];
  });
}
