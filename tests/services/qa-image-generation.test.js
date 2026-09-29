import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,rm,symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { validateGeneratedImages,persistGeneratedImages } from '../../lib/services/qa-image-generation.js';

const output={variation:1,filename:'1.png',passed:true,native_tool:'image_gen__imagegen',prompt:'QA fixture',quality_checks:['Typography checked'],reference_anatomy:'No reference'};
test('image validation rejects placeholders, incomplete batches, duplicate variations and path escapes',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'qa-image-test-'));
  try{
    await writeFile(join(dir,'1.png'),'not an image');
    await assert.rejects(validateGeneratedImages(dir,{status:'done',outputs:[output]},1),/PNG/);
    await assert.rejects(validateGeneratedImages(dir,{status:'done',outputs:[]},1),/incomplete/);
    await assert.rejects(validateGeneratedImages(dir,{status:'done',outputs:[{...output,passed:false}]},1),/manifest/);
    const bytes=await sharp({create:{width:512,height:512,channels:3,background:'#2495ac'}}).png().toBuffer();
    await writeFile(join(dir,'1.png'),bytes);
    const images=await validateGeneratedImages(dir,{status:'done',outputs:[output]},1);
    assert.equal(images[0].metadata.width,512);
    await writeFile(join(dir,'2.png'),bytes);
    await assert.rejects(validateGeneratedImages(dir,{status:'done',outputs:[output,{...output,variation:2,filename:'2.png'}]},2),/Duplicate/);
    await rm(join(dir,'1.png'));await symlink('/etc/hosts',join(dir,'1.png'));
    await assert.rejects(validateGeneratedImages(dir,{status:'done',outputs:[output]},1),/Invalid generated/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('only complete batches publish metadata; upload failure removes partial objects',async()=>{
  const events=[];let failed=false;
  const db={storage:{from:bucket=>{assert.equal(bucket,'qa-producer-images');return{
    upload:async(path,bytes,options)=>{events.push(['upload',path,options]);return{error:failed&&path.endsWith('2.png')?{message:'fail'}:null};},
    remove:async paths=>{events.push(['remove',paths]);return{};}};}},from:table=>{assert.equal(table,'qa_image_runs');return{update:value=>{events.push(['update',value]);const chain={eq:()=>chain,select:async()=>({data:[{id:'run'}]})};return chain;}};}};
  const images=[1,2].map(i=>({bytes:Buffer.from('mock'),metadata:{filename:`${i}.png`}}));
  await persistGeneratedImages(db,{id:'run'},images);
  assert.equal(events.at(-1)[1].status,'done');assert.equal(events.at(-1)[1].outputs.length,2);
  events.length=0;failed=true;await assert.rejects(persistGeneratedImages(db,{id:'run'},images),/upload/);
  assert.deepEqual(events.at(-1),['remove',['run/1.png']]);assert.equal(events.some(e=>e[0]==='update'),false);
});
test('a lost finalization response never deletes an already-published image',async()=>{
  let removed=false;
  const outputs=[{path:'run/1.png'}];
  const db={storage:{from:()=>({upload:async()=>({}),remove:async()=>{removed=true;}})},from:()=>({
    update:()=>{const chain={eq:()=>chain,select:async()=>({error:new Error('Response lost')})};return chain;},
    select:()=>({eq:()=>({maybeSingle:async()=>({data:{status:'done',outputs}})})})
  })};
  assert.deepEqual(await persistGeneratedImages(db,{id:'run'},[{bytes:Buffer.from('test'),metadata:{filename:'1.png'}}]),outputs);
  assert.equal(removed,false);
});
