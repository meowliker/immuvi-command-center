import { timestampMs } from './action-plan.js';

const text = (value) => value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
const time = (value) => { const ms = timestampMs(value); return ms !== null && Number.isFinite(new Date(ms).getTime()) ? ms : null; };
const titles = { pushed_to_clickup: 'Pushed to ClickUp', clickup_task_created: 'Pushed to ClickUp', adopted: 'Auto-adopted from ClickUp', tag_removed: 'Production tag removed', tag_added: 'Production tag added', task_deleted_in_cu: 'Task deleted in ClickUp', relinked: 'Re-linked via marker', status_changed: 'Status changed', assignee_changed: 'Assignment changed', removed_from_plan: 'Removed from Action Plan', restored_to_plan: 'Restored to Action Plan' };
/** @returns {{id: string, type: string, ts: number|null, title: string, detail: string, actor: string, source: string}[]} */
export function planHistoryTimeline(rows, payload = {}) {
  const events = rows.map((row) => ({ id: `event:${row.id}`, type: text(row.event_type), ts: time(row.created_at),
    detail: row.field_name ? `${text(row.field_name)}: ${text(row.old_value) || '-'} -> ${text(row.new_value) || '-'}` : text(row.new_value) || (row.clickup_task_id ? `ClickUp task ${text(row.clickup_task_id)}` : ''),
    actor: text(row.actor), source: text(row.source) || 'Recorded event' }));
  const legacy = Array.isArray(payload._history) ? payload._history : [];
  legacy.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object' || !entry.type) return;
    events.push({ id: `legacy:${index}`, type: text(entry.type), ts: time(entry.ts), detail: text(entry.detail), actor: text(entry.by), source: 'Legacy history' });
  });
  if (payload._origin === 'adopted' && time(payload._adoptedAt) !== null && !events.some((event) => event.type === 'adopted')) {
    events.push({ id: 'milestone:adopted', type: 'adopted', ts: time(payload._adoptedAt), detail: 'Auto-adopted from ClickUp production tag', actor: '', source: 'Saved milestone' });
  }
  if (time(payload._pushedAt) !== null && !events.some((event) => ['pushed_to_clickup', 'clickup_task_created'].includes(event.type))) {
    events.push({ id: 'milestone:pushed', type: 'pushed_to_clickup', ts: time(payload._pushedAt), detail: text(payload._clickupId || payload.clickupTaskId), actor: '', source: 'Saved milestone' });
  }
  // Preserve database ordering for sub-millisecond timestamps JS cannot distinguish.
  return events.map((event, order) => ({ ...event, order, title: Object.hasOwn(titles, event.type) ? titles[event.type] : event.type.replaceAll('_', ' ') || 'Event' }))
    .sort((a, b) => (a.ts === null) !== (b.ts === null) ? a.ts === null ? 1 : -1 : (b.ts ?? 0) - (a.ts ?? 0) || a.order - b.order);
}
