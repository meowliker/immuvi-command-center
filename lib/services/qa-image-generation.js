import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { IMAGE_BUCKET } from '../domain/image-producer.js';

export async function validateGeneratedImages(directory, manifest, count) {
  if (manifest?.status !== 'done') throw new Error(manifest?.error || 'Native image generation did not complete.');
  if (!Array.isArray(manifest.outputs) || manifest.outputs.length !== count) throw new Error('Image batch is incomplete.');
  const root = await realpath(directory), hashes = new Set(), images = [];
  for (let i=0;i<count;i++) {
    const output = manifest.outputs[i];
    if (output.variation !== i+1 || output.filename !== `${i+1}.png` || output.passed !== true
      || !output.native_tool?.includes('imagegen') || !output.prompt || !output.quality_checks?.length) throw new Error('Image quality manifest is invalid.');
    const path = await realpath(resolve(root,output.filename));
    if (!path.startsWith(root+sep) || (await stat(path)).size > 20*1024*1024) throw new Error('Invalid generated image file.');
    const bytes = await readFile(path);
    if (bytes.length < 1000 || bytes.subarray(0,8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Expected a generated PNG image.');
    const decoder=sharp(bytes,{limitInputPixels:40_000_000,failOn:'warning'});
    const meta=await decoder.metadata();
    if (meta.format!=='png' || meta.width<256 || meta.height<256 || (meta.pages||1)!==1) throw new Error('Generated image dimensions are invalid.');
    await decoder.stats(); // Fully decode; a valid header alone does not prove a valid image.
    const hash=createHash('sha256').update(bytes).digest('hex');
    if(hashes.has(hash)) throw new Error('Duplicate variation output.');
    hashes.add(hash);
    images.push({bytes,metadata:{...output,width:meta.width,height:meta.height,sha256:hash}});
  }
  return images;
}

export async function persistGeneratedImages(db, run, images) {
  const outputs=[];
  let finalizeAttempted=false;
  try {
    for(const image of images){
      const path=`${run.id}/${image.metadata.filename}`;
      const upload=await db.storage.from(IMAGE_BUCKET).upload(path,image.bytes,{contentType:'image/png',upsert:false});
      if(upload.error) throw new Error('Could not upload image to QA Supabase.');
      outputs.push({...image.metadata,path,bucket:IMAGE_BUCKET});
    }
    finalizeAttempted=true;
    const saved=await db.from('qa_image_runs').update({status:'done',outputs,finished_at:new Date().toISOString(),error:null})
      .eq('id',run.id).eq('status','running').select('id');
    if(saved.error || saved.data?.length!==1) throw new Error('Could not finalize the QA image batch.');
    return outputs;
  } catch(error) {
    // A dropped response can hide a committed update. Never delete published images.
    if(finalizeAttempted){
      const current=await db.from('qa_image_runs').select('status,outputs').eq('id',run.id).maybeSingle();
      if(current.error)throw new Error('Image upload completed, but final status is uncertain. Review the QA run before retrying.');
      if(current.data?.status==='done')return current.data.outputs;
    }
    if(outputs.length) await db.storage.from(IMAGE_BUCKET).remove(outputs.map(o=>o.path));
    throw error;
  }
}
