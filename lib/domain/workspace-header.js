export function reloadState(value) {
  if (!value || !Number.isFinite(Date.parse(value.serverNow))) throw new Error('Reload service response could not be verified.');
  const row=value.latest;
  if (row && (!row.id || !Number.isFinite(Date.parse(row.triggered_at)) || typeof row.triggered_by!=='string')) throw new Error('Reload request could not be verified.');
  return value;
}
export function notificationText(value) {
  const text = String(value || '').trim();
  if (/^\d+ tasks? checked:\s*\d+ imported,\s*\d+ updated,\s*\d+ skipped\.?$/i.test(text)) return '';
  return text.replace(/\bpk_[A-Za-z0-9_-]+/g,'[hidden key]').replace(/Bearer\s+\S+/gi,'Bearer [hidden]').slice(0,1200);
}
export function syncAge(value, now=Date.now()) {
  const elapsed=Math.max(0,Math.floor((now-Number(value))/1000));
  return !Number(value)?'Not synced':elapsed<5?'just now':elapsed<60?`${elapsed}s ago`:`${Math.floor(elapsed/60)}m ago`;
}
