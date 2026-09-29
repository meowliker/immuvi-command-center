import type { SupabaseClient } from '@supabase/supabase-js';
import { requestQaClickUp } from './qa-clickup';

export async function createRecommendationClickUpTask(supabase: SupabaseClient, productId: string, recommendationId: string) {
  const result = await requestQaClickUp(supabase, productId, { operation: 'create-recommendation', recommendationId });
  return String(result.id);
}

export async function syncClickUpTaskFields(supabase: SupabaseClient, productId: string, taskId: string, fields: Record<string, unknown>) {
  if (!taskId) return '';
  try {
    await requestQaClickUp(supabase, productId, { operation: 'update-task', taskId, fields });
    return '';
  } catch (error) {
    return `Saved in QA, but ClickUp sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}
