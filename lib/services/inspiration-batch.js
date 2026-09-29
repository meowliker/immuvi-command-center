import { mutateInspiration } from './inspiration-mutations.js';

// Keep immutable per-source receipt IDs; stop at uncertain writes instead of replaying successes.
/** @param {any} db @param {any[]} entries @param {{pushCreative?: (id: string) => Promise<{failed?: unknown[]}>, progress?: (entries: any[]) => void}} options */
export async function importInspirationBatch(db, entries, { pushCreative, progress = (_entries) => {} } = {}) {
  const next = structuredClone(entries);
  for (const entry of next) {
    if (!['pending','uncertain'].includes(entry.status)) continue;
    try {
      const saved = await mutateInspiration(db,entry.request);
      entry.status = 'imported'; entry.error = '';
      let pending = 0;
      for (const id of saved.remoteAdIds) {
        try { if (!pushCreative || (await pushCreative(id)).failed?.length) pending++; } catch { pending++; }
      }
      entry.warning = pending ? `${pending} ClickUp name updates pending in Creative Tracker.` : '';
    } catch (error) {
      entry.status = error.definite ? 'failed' : 'uncertain';
      entry.error = error.message || 'Import could not be confirmed.';
    }
    progress(structuredClone(next));
    if (entry.status === 'uncertain') break;
  }
  return next;
}
