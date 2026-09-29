// Fail closed for old scripts that used a broad service-role shared queue.
throw new Error('Shared QA image worker retired. Use install-private-worker.mjs --owner=<your QA login> for an owner-only device.');
