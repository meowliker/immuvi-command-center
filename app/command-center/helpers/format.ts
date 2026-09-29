import { timestampMs } from '../../../lib/domain/action-plan.js';

export function formatDateTime(value: string | number | null | undefined) {
  const dateMs = timestampMs(value);
  if (!dateMs) return '';
  return new Date(dateMs).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(value: string | number | null | undefined) {
  const dateMs = timestampMs(value);
  if (!dateMs) return '-';
  return new Date(dateMs).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatAge(ageMs: number | null) {
  if (ageMs === null) return 'unknown';
  const minutes = Math.floor(ageMs / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

export function formatCreatedAge(timestamp: number | null | undefined, now = Date.now()) {
  if (!timestamp || !Number.isFinite(timestamp)) return '-';
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d` : `${Math.floor(days / 7)}w`;
}
