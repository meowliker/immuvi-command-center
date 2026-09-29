// Keep the old entry point explicit, rather than silently starting a shared worker.
throw new Error('Shared QA image worker retired. Use install-private-worker.mjs --owner=<your QA login> for an owner-only device.');
