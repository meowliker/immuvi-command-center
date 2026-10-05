import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { atomicJson } from './shared-worker-updates.js';
import { validateGeneratedImages } from './qa-image-generation.js';
import { IMAGE_BUCKET } from '../domain/image-producer.js';
import { workerDestination, SHARED_QA_PRODUCT } from './shared-worker.js';

export const imageHash = bytes => createHash('sha256').update(bytes).digest('hex');
function canonical(value) {
  if(Array.isArray(value))return value.map(canonical);
  if(value && typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}
const uncertain = message => Object.assign(new Error(message), { code: 'IMAGE_OUTCOME_UNCERTAIN' });
export function generationName(taskName, variation) {
  const base=String(taskName || '').replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').replace(/^[ .-]+|[ .-]+$/g,'');
  if (!base || base.length>160 || !Number.isInteger(variation) || variation<1 || variation>10) throw new Error('Invalid generation filename.');
  return `${base}-${variation}.png`;
}
export function assertSharedImageJob(config,run) {
  imageDestination(run);
  if(config.scope!=='shared' || run.private_worker_id!==config.id
    || run.status!=='running' || !run.lease_id || !run.delivery?.task_id || run.delivery.protocol!==1)
    throw new Error('Image run is outside the shared QA boundary.');
}
export function imageDestination(run) {
  const snapshot=run.delivery?.destination;
  const destination=workerDestination(run.product_id,{listId:run.delivery?.list_id});
  if(snapshot || run.product_id!==SHARED_QA_PRODUCT) {
    workerDestination(run.product_id,snapshot,{library:true,tracker:true});
    if(snapshot.productId!==run.product_id || snapshot.workspaceId!==destination.workspaceId)throw new Error('Unapproved image destination snapshot.');
  }
  return destination;
}

// One persistent generation boundary per variation. Never replay a possibly paid
// call merely because its response or the database acknowledgment disappeared.
export async function recoverSharedImages({run,directory,signal,checkpoint,prepare,generate,storage,deliver,validate=validateGeneratedImages}) {
  signal.throwIfAborted();
  await mkdir(directory,{recursive:true,mode:0o700});
  const identity=imageHash(JSON.stringify(canonical({id:run.id,worker:run.private_worker_id,product:run.product_id,
    list:run.delivery.list_id,destination:run.delivery.destination,protocol:run.delivery.protocol,request:run.request,task:run.delivery.task_id})));
  let legacyIdentity;
  if(run.product_id===SHARED_QA_PRODUCT && !run.delivery.destination) {
    imageDestination(run);
    legacyIdentity=imageHash(JSON.stringify({id:run.id,worker:run.private_worker_id,request:run.request,task:run.delivery.task_id}));
  }
  const contextPath=join(directory,'producer-context.json');
  let prepared;
  try {
    const saved=JSON.parse(await readFile(contextPath,'utf8'));
    if(saved.identity!==identity && !(legacyIdentity!==undefined && saved.identity===legacyIdentity))throw uncertain('Producer context changed. Review retained output before retrying.');
    prepared=saved.context;
  } catch(error) {
    if(error.code!=='ENOENT')throw error;
    if(run.delivery.started?.length)throw uncertain('Saved Producer context is missing after generation started.');
    prepared=await prepare();
    await atomicJson(contextPath,{identity,context:prepared});
  }
  const root=await realpath(directory);
  for(const path of prepared.referenceFiles || []) {
    if(!(await realpath(path)).startsWith(root+sep))throw new Error('Reference escaped the Producer directory.');
  }
  const outputs=[],hashes=new Set();
  for(let variation=1;variation<=run.request.options.count;variation++) {
    signal.throwIfAborted();
    const local=join(directory,`variation-${variation}`);
    await mkdir(local,{recursive:true,mode:0o700});
    let image;
    const known=run.delivery.outputs?.find(o=>o.variation===variation);
    if(known) {
      const found=await storage.download(known.path);
      if(found.error)throw new Error('Saved image is unavailable. Generation will not be repeated.');
      const bytes=Buffer.from(await found.data.arrayBuffer());
      if(imageHash(bytes)!==known.sha256)throw new Error('Saved image checksum changed.');
      image={bytes,metadata:known};
    } else {
      const accepted=join(local,'accepted.json');
      let manifest;
      try {manifest=JSON.parse(await readFile(accepted,'utf8'));}
      catch(error) {
        if(error.code!=='ENOENT')throw error;
        if(run.delivery.started?.includes(variation)) {
          try {manifest=JSON.parse(await readFile(join(local,'result.json'),'utf8'));}
          catch {throw uncertain(`Variation ${variation} was interrupted without a verified final image. Review it before requesting another generation.`);}
        } else {
          await checkpoint('generation-start',{variation});
          run.delivery.started ??=[];run.delivery.started.push(variation);
          manifest=await generate({variation,directory:local,context:prepared,previous:outputs});
        }
      }
      [image]=await validate(local,manifest,1);
      await atomicJson(accepted,manifest);
      image.metadata={...image.metadata,variation,filename:generationName(prepared.taskName,variation),
        path:`${run.id}/${variation}.png`,bucket:IMAGE_BUCKET};
      if(hashes.has(image.metadata.sha256))throw new Error('Duplicate variation output.');
      signal.throwIfAborted();
      // Read before upload and after an uncertain response. Never overwrite a
      // different object or delete a possibly committed output during recovery.
      const stored=await storage.download(image.metadata.path);
      if(!stored.error) {
        if(imageHash(Buffer.from(await stored.data.arrayBuffer()))!==image.metadata.sha256)throw new Error('Stored image conflicts with the accepted output.');
      } else {
        if(![400,404].includes(Number(stored.error.statusCode || stored.error.status)))throw new Error('Could not verify saved image storage.');
        const uploaded=await storage.upload(image.metadata.path,image.bytes,{contentType:'image/png',upsert:false});
        if(uploaded.error) {
          const verified=await storage.download(image.metadata.path);
          if(verified.error || imageHash(Buffer.from(await verified.data.arrayBuffer()))!==image.metadata.sha256)throw Object.assign(new Error('Image upload outcome needs recovery.'),{code:'NETWORK_UNAVAILABLE'});
        }
      }
      await checkpoint('output',image.metadata);
    }
    if(hashes.has(image.metadata.sha256))throw new Error('Duplicate variation output.');
    hashes.add(image.metadata.sha256);
    // Match legacy sequencing: accepted variation N is attached before N+1.
    const receipt=await deliver(image,variation);
    outputs.push({...image.metadata,...receipt});
  }
  return {outputs,context:prepared};
}
