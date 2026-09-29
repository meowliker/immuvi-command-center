import type { StrategistApprovalResult, StrategistMemory, StrategistRecommendation, StrategistRun } from '../types';
import { normalizeCompetitorCreative } from './competitors';
import { numberOrNullValue, objectRecord, textValue } from './values';

export function normalizeStrategistRun(row: unknown): StrategistRun {
  const record = objectRecord(row);
  return {
    id: textValue(record.id),
    status: textValue(record.status),
    trigger: textValue(record.trigger),
    runDate: textValue(record.run_date),
    startedAt: textValue(record.started_at),
    finishedAt: textValue(record.finished_at),
    error: textValue(record.error),
    workerId: textValue(record.worker_id),
    createdAt: textValue(record.created_at),
    tasksProcessed: numberOrNullValue(record.tasks_processed) || 0,
    tasksSkipped: numberOrNullValue(record.tasks_skipped) || 0,
  };
}

export function normalizeStrategistMemory(row: unknown): StrategistMemory {
  const record = objectRecord(row);
  return {
    productId: textValue(record.product_id),
    json: objectRecord(record.json),
    markdown: textValue(record.markdown),
    updatedAt: textValue(record.updated_at),
  };
}

export function normalizeStrategistRecommendation(row: unknown): StrategistRecommendation {
  const record = objectRecord(row);
  const source = Array.isArray(record.competitor_creatives)
    ? record.competitor_creatives[0]
    : record.competitor_creatives;
  return {
    id: textValue(record.id),
    status: textValue(record.status) || 'pending',
    recommendationType: textValue(record.recommendation_type),
    confidenceBand: textValue(record.confidence_band),
    recommendedHook: textValue(record.recommended_hook),
    recommendedAngle: textValue(record.recommended_angle),
    recommendedPersona: textValue(record.recommended_persona),
    recommendedFormat: textValue(record.recommended_format),
    reasoning: textValue(record.reasoning),
    taskId: textValue(record.task_id),
    manualActionId: textValue(record.manual_action_id),
    inspirationId: textValue(record.inspiration_id),
    adId: textValue(record.ad_id),
    taskCreatedAt: textValue(record.task_created_at),
    generatedAt: textValue(record.generated_at),
    sourceCreative: source ? normalizeCompetitorCreative(source) : undefined,
  };
}

export function normalizeStrategistApprovalResult(value: unknown): StrategistApprovalResult {
  const record = objectRecord(value);
  return {
    recommendationId: textValue(record.recommendation_id),
    inspirationId: textValue(record.inspiration_id),
    adId: textValue(record.ad_id),
    manualActionDbId: textValue(record.manual_action_db_id),
    manualActionId: textValue(record.manual_action_id),
    taskId: textValue(record.task_id),
    alreadyTasked: Boolean(record.already_tasked),
  };
}
