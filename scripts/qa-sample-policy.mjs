import { randomUUID } from 'node:crypto';

export const SOURCE_REF = 'hdniumnkprkadlrrataz';
export const TARGET_REF = 'entgcnlfsnysnwyadzzp';
export const PRODUCTS = [
  { source:'prod-1778009469915', target:'qa-sample-astrorekha', name:'AstroRekha - QA Sample' },
  { source:'prod-1776684457079', target:'qa-sample-canva', name:'Canva - QA Sample' },
];
export const CONTENT_TABLES = ['products','angles','personas','angle_personas','ads','matrix_cells','manual_actions','inspirations','inspiration_queue','inspiration_results','competitor_brands','competitor_creatives','competitor_research_queue','strategist_recommendations','strategist_memory','strategist_runs','strategist_processed','producer_runs','activity_events','deleted_ads','task_video_winners','task_drive_cache','variation_briefs','variation_brief_queue','worker_registry'];
export const WRITE_TABLES = [...CONTENT_TABLES, 'user_products', 'admin_audit_log'];
export const pick = (object, keys) => Object.fromEntries(keys.filter((key) => object?.[key] !== undefined).map((key) => [key, object[key]]));
const sensitiveKey = /clickup|onescale|store.?id|product.?profile|token|secret|password|authorization|api.?key|webhook|callback|credential|assignee|email|hostname|worker.?assignment|claimed.?by|customfieldsraw|clientid|pushed|history|dupe|reusedin|importedto|trackerref|quarantin/i;

// Retain narrative content, but never live destinations, account identities or
// operational integration metadata. Local record references must be remapped.
export function sanitize(value, ids = new Map()) {
  if (Array.isArray(value)) return value.map((item) => sanitize(item, ids));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !sensitiveKey.test(key))
    .map(([key, item]) => [ids.get(key) || key, /(?:^id$|_id$|Id$)/.test(key) && typeof item === 'string'
      ? ids.get(item) || null : sanitize(item, ids)]));
  if (typeof value !== 'string') return value;
  if (ids.has(value)) return ids.get(value);
  return value.replace(/https?:\/\/[^\s<>"')\]]+/gi, 'https://example.invalid/qa-reference')
    .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, 'qa-sample@example.test')
    .replace(/\b(?:eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|sb_secret_[A-Za-z0-9_-]+|pk_[A-Za-z0-9_-]+)\b/g, '[removed]')
    .replaceAll(SOURCE_REF, '[source-project]');
}
export function newId(type) { return type === 'uuid' ? randomUUID() : `qa-sample-${randomUUID()}`; }
export function assertPlan(rows) {
  for (const [table, records] of Object.entries(rows)) {
    if (!WRITE_TABLES.includes(table)) throw new Error(`Forbidden seed table: ${table}`);
    for (const row of records) {
      if (row.product_id && !PRODUCTS.some((product) => product.target === row.product_id)) throw new Error('Foreign seed product.');
      if (table === 'products' && (!PRODUCTS.some((p) => p.target === row.id) || row.config?.clickup_list_id)) throw new Error('Unsafe product.');
      if (table === 'worker_registry' && (row.enabled !== false || row.status !== 'offline')) throw new Error('Executable worker.');
      if (['inspiration_queue','competitor_research_queue','variation_brief_queue','producer_runs','strategist_runs'].includes(table)
        && !['done','failed','cancelled'].includes(row.status)) throw new Error('Executable queue item.');
      if (table !== 'strategist_processed' && row.clickup_task_id) throw new Error('Live ClickUp identity.');
      if (table === 'strategist_processed' && !row.clickup_task_id.startsWith('qa-sample-')) throw new Error('Live processed identity.');
      if (row.task_id && !row.task_id.startsWith('qa-sample-')) throw new Error('Live task identity.');
      if (JSON.stringify(row).includes(SOURCE_REF) || /https?:\/\/(?!example\.invalid[\/\s"])/i.test(JSON.stringify(row))) throw new Error('External destination survived sanitization.');
    }
  }
}
