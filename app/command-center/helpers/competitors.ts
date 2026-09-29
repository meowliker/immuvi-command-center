import type { CompetitorBrand, CompetitorCreative, CompetitorJob } from '../types';
import { numberOrNullValue, objectRecord, textValue } from './values';

export function normalizeCompetitorBrand(row: unknown): CompetitorBrand {
  const record = objectRecord(row);
  return {
    id: textValue(record.id),
    productId: textValue(record.product_id),
    name: textValue(record.name) || 'Untitled brand',
    category: textValue(record.category) || 'direct',
    metaPageId: textValue(record.meta_page_id),
    metaAdLibraryUrl: textValue(record.meta_ad_library_url),
    homepageUrl: textValue(record.homepage_url),
    activeAdCount: numberOrNullValue(record.active_ad_count),
    lastSeenAt: textValue(record.last_seen_at),
    approved: Boolean(record.approved),
    approvedAt: textValue(record.approved_at),
    approvedBy: textValue(record.approved_by),
    notes: textValue(record.notes),
    createdAt: textValue(record.created_at),
  };
}

export function normalizeCompetitorJob(row: unknown): CompetitorJob {
  const record = objectRecord(row);
  return {
    id: textValue(record.id),
    brandId: textValue(record.brand_id),
    jobType: textValue(record.job_type),
    status: textValue(record.status),
    errorMessage: textValue(record.error_message),
    createdAt: textValue(record.created_at),
    startedAt: textValue(record.started_at),
    finishedAt: textValue(record.finished_at),
    resultSummary: objectRecord(record.result_summary),
  };
}

export function normalizeCompetitorCreative(row: unknown): CompetitorCreative {
  const record = objectRecord(row);
  return {
    id: textValue(record.id),
    brandId: textValue(record.brand_id),
    hook: textValue(record.hook),
    angle: textValue(record.angle),
    persona: textValue(record.persona),
    adUrl: textValue(record.ad_url),
    visualPattern: textValue(record.visual_pattern),
    whyItWorks: textValue(record.why_it_works),
    statusLabel: textValue(record.status_label),
    rankInBrand: numberOrNullValue(record.rank_in_brand),
  };
}
