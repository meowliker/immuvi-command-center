import type { ActionRecord } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { savePlanWorkflow } from '../../../lib/services/action-plan-workflow.js';
import { requestQaClickUp } from './qa-clickup';
import { matchingClickUpStatus } from '../../../lib/domain/clickup-statuses.js';

async function save(db: SupabaseClient, productId: string, action: ActionRecord, operation: string, value: string) {
  if (operation === 'status' && action.display.clickupTaskId) {
    const schema = await requestQaClickUp(db, productId, { operation: 'plan-statuses' });
    matchingClickUpStatus(value, schema.statuses);
  }
  const result = await savePlanWorkflow(db, productId, action, operation, value);
  let clickUpWarning = '';
  if (result.linkedAdId && result.taskId) {
    try {
      const pushed = await requestQaClickUp(db, productId, { operation: 'push-creative', adId: result.linkedAdId, actionId: action.display.dbId });
      if (pushed.failed?.length) clickUpWarning = `Saved in QA. ClickUp changes remain pending: ${pushed.failed.map((field: { field: string; error: string }) => `${field.field}: ${field.error}`).join('; ')}`;
    } catch (cause) { clickUpWarning = `Saved in QA. ClickUp changes remain pending: ${cause instanceof Error ? cause.message : 'Request failed.'}`; }
  }
  return { ...result, clickUpWarning };
}

export function persistActionStatus(db: SupabaseClient, productId: string, action: ActionRecord, status: string) {
  return save(db, productId, action, 'status', status);
}

export function persistActionDueDate(db: SupabaseClient, productId: string, action: ActionRecord, dueDate: string) {
  return save(db, productId, action, 'due', dueDate);
}
