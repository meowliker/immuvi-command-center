import { QA_SUPABASE_URL } from '../qa-supabase-env.js';

export function validatePrivateWorkerConfig(config) {
  const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
  if (config?.version !== 1 || config.environment !== 'qa' || config.url !== QA_SUPABASE_URL
    || !uuid.test(config.id) || !uuid.test(config.ownerId) || !/^[a-f\d]{64}$/.test(config.token)
    || typeof config.anonKey !== 'string' || !config.codexBin?.startsWith('/')) {
    throw new Error('Invalid private worker pairing. Production requires separate explicit enrollment.');
  }
  const claims = JSON.parse(Buffer.from(config.anonKey.split('.')[1] || '', 'base64url').toString());
  if (claims.role !== 'anon' || claims.ref !== 'entgcnlfsnysnwyadzzp') throw new Error('Worker requires a public QA key, never a service key.');
  return config;
}

export function privateWorkerHeaders(config, lease) {
  return { 'x-immuvi-worker-id': config.id, 'x-immuvi-worker-token': config.token,
    ...(lease ? { 'x-immuvi-worker-lease': lease } : {}) };
}

export function assertPrivateJob(config, run) {
  if (run.private_worker_id !== config.id || run.requested_by !== config.ownerId || run.status !== 'running'
    || !run.lease_id || !run.id || !run.product_id || !run.request?.options) {
    throw new Error('Private worker refused a job outside its owner or device boundary.');
  }
}

export async function finishPrivateImages(db, run, images) {
  const outputs = [];
  for (const image of images) {
    const path = `${run.id}/${image.metadata.filename}`;
    const upload = await db.storage.from('qa-producer-images').upload(path, image.bytes, { contentType: 'image/png', upsert: false });
    if (upload.error) throw new Error('Private image upload failed. Uploaded files are retained for review.');
    outputs.push({ ...image.metadata, path, bucket: 'qa-producer-images' });
  }
  // Finalization is idempotent; a lost response must not delete uploaded images or
  // trigger another paid generation. Retrying this RPC only retries publication.
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await db.rpc('qa_private_image_finish', { p_id: run.id, p_lease: run.lease_id, p_outputs: outputs });
    if (!result.error) {
      if (result.data !== 'done') throw new Error('Image run was interrupted before publication.');
      return outputs;
    }
    if (attempt === 2) throw new Error('Images uploaded; final status is uncertain. Review this run before retrying.');
  }
}
