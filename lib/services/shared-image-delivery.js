import { constants, privateDecrypt } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { createClickUpClient } from './clickup-client.js';
import { producerBrief, producerInstruction } from '../domain/image-producer.js';
import { imageHash, generationName } from './shared-image-recovery.js';

const LIST='1301130000002447',WORKSPACE='9016762494',LIBRARY='8cq1r3y-44896';
const ambiguous=message=>Object.assign(new Error(message),{code:'IMAGE_OUTCOME_UNCERTAIN'});
const attachmentUrl=attachment=>attachment?.url_w_query || attachment?.url;
export function producerLinks(value) {
  return [...new Set(String(value || '').match(/https:\/\/[^\s<>"\)\]]+/g)||[])];
}
export function createSharedImageDelivery({run,privateKey,signal,checkpoint,download,extract,fetchImpl=fetch,token:injectedToken}) {
  const token=injectedToken || privateDecrypt({key:privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(run.delivery.sealed_token,'base64')).toString();
  const boundedFetch=(url,init={})=>fetchImpl(url,{...init,signal:AbortSignal.any([signal,AbortSignal.timeout(30000)])});
  const cu=createClickUpClient(token,{fetchImpl:boundedFetch,signal});
  const taskId=run.delivery.task_id;
  if(!/^[a-zA-Z0-9_-]+$/.test(taskId)||run.delivery.list_id!==LIST)throw new Error('Unapproved Producer destination.');
  async function guard(){signal.throwIfAborted();await checkpoint('heartbeat');return cu.getTask(LIST,taskId);}
  async function request(path,method='GET',body) {
    signal.throwIfAborted();
    const multipart=body instanceof FormData;
    const response=await boundedFetch(`https://api.clickup.com/api/${path}`,{method,redirect:'error',
      headers:{Authorization:token,...(!multipart?{'Content-Type':'application/json'}:{})},
      ...(body?{body:multipart?body:JSON.stringify(body)}:{})});
    if(!response.ok)throw Object.assign(new Error(`ClickUp Producer request failed (${response.status}). Saved work is retained.`),{status:response.status});
    return response.json();
  }
  async function prepare(directory) {
    const task=await guard(),comments=await cu.comments(LIST,taskId),{options,creative,references=[],memory={}}=run.request;
    generationName(task.name,1);
    const taskContext={name:task.name,description:task.description,text_content:task.text_content,custom_fields:task.custom_fields,
      comments:comments.map(c=>c.comment_text || c.comment?.map(t=>t.text||'').join('') || ''),attachments:task.attachments || []};
    const text=JSON.stringify(taskContext),links=producerLinks(text.replaceAll('\\n','\n'));
    const docs=[];
    for(const link of links) {
      const match=link.match(/^https:\/\/app\.clickup\.com\/9016762494\/docs\/([\w-]+)\/([\w-]+)$/);
      if(!match)continue;
      if(match[1]!==LIBRARY)throw new Error('Linked brief is outside the approved QA library.');
      const page=await request(`v3/workspaces/${WORKSPACE}/docs/${LIBRARY}/pages/${match[2]}?content_format=text%2Fmd`);
      docs.push({name:page.name,content:page.content});
    }
    const candidates=[options.referenceUrl,...references.map(r=>r.drive_link||r.ad_link)];
    if(!candidates.some(Boolean)) {
      const contextual=[...links,...producerLinks(docs.map(d=>d.content).join('\n'))];
      candidates.push(...contextual.filter(url=>/https:\/\/(?:www\.)?(?:facebook\.com|instagram\.com|tiktok\.com|youtube\.com|youtu\.be|drive\.google\.com)\//.test(url)));
      if(!candidates.some(Boolean))candidates.push(...(task.attachments||[]).filter(a=>/\.(png|jpe?g|webp)$/i.test(a.title||'')).map(attachmentUrl));
    }
    const referenceFiles=[],referenceSources=[];
    for(const source of [...new Set(candidates.filter(Boolean))].slice(0,10)) {
      const target=join(directory,`reference-${referenceSources.length+1}`);await mkdir(target,{recursive:true,mode:0o700});
      const url=new URL(source);let paths;
      if(['facebook.com','www.facebook.com','instagram.com','www.instagram.com','youtube.com','www.youtube.com','youtu.be','tiktok.com','www.tiktok.com'].includes(url.hostname)) {
        const media=await extract(source,target,signal);paths=media.frames.slice(0,6);
      } else {
        let direct=source;
        if(['drive.google.com','docs.google.com'].includes(url.hostname)) {
          const id=url.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] || url.searchParams.get('id');
          if(!/^[\w-]+$/.test(id||''))throw new Error('Select a downloadable Drive image file, not a folder.');
          direct=`https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
        }
        const bytes=await download(direct,0,signal),metadata=await sharp(bytes,{limitInputPixels:40_000_000}).metadata();
        if(!['png','jpeg','webp'].includes(metadata.format))throw new Error('Reference is not an image.');
        const path=join(target,`source.${metadata.format}`);await writeFile(path,bytes,{mode:0o600});paths=[path];
      }
      referenceFiles.push(...paths);referenceSources.push(source);
    }
    const context={taskName:task.name,task:taskContext,briefPages:docs,brief:producerBrief(creative),selectedFormats:references.map(producerBrief),
      strategist:memory,strategistMarkdown:run.request.memoryMarkdown || '',directives:producerInstruction(options),count:options.count,referenceFiles,referenceSources};
    if(JSON.stringify(context).length>300000)throw new Error('Producer context exceeds the safe input limit.');
    return context;
  }
  async function deliver(image,variation) {
    const task=await guard(),output=image.metadata,key=String(variation),d=run.delivery;
    const receipt=d.receipts?.[key],intent=d.intents?.[key];
    async function verified(attachment) {
      if(!attachment?.id || !attachmentUrl(attachment))throw ambiguous('Uploaded image is not yet visible on the task. Reconcile saved receipts before retrying.');
      const bytes=await download(attachmentUrl(attachment),0,signal);
      if(imageHash(bytes)!==output.sha256)throw ambiguous('ClickUp attachment bytes differ from the accepted image.');
      const saved={variation,id:String(attachment.id),url:attachmentUrl(attachment)};
      await checkpoint('attachment',saved);d.receipts ??={};d.receipts[key]=saved;return saved;
    }
    if(receipt)return verified(task.attachments?.find(a=>String(a.id)===receipt.id));
    if(intent) {
      const candidates=(task.attachments||[]).filter(a=>!(intent.before||[]).includes(String(a.id))&&a.title===output.filename);
      if(candidates.length!==1)throw ambiguous(`Variation ${variation} upload outcome is uncertain. No duplicate attachment was created.`);
      return verified(candidates[0]);
    }
    const start={variation,before:(task.attachments||[]).map(a=>String(a.id)),filename:output.filename,sha256:output.sha256};
    await checkpoint('attachment-start',start);d.intents ??={};d.intents[key]=start;
    await guard();
    const form=new FormData();form.append('attachment',new Blob([image.bytes],{type:'image/png'}),output.filename);
    const uploaded=await request(`v2/task/${taskId}/attachment`,'POST',form);
    const refreshed=await guard();
    return verified(refreshed.attachments?.find(a=>String(a.id)===String(uploaded.id)));
  }
  async function finish(outputs) {
    await guard();
    const d=run.delivery,marker=`[Immuvi QA Producer ${run.id}]`;
    const comments=await cu.comments(LIST,taskId);
    const matches=comments.filter(c=>(c.comment_text || c.comment?.map(t=>t.text||'').join('') || '').includes(marker));
    if(matches.length>1)throw ambiguous('Multiple Producer receipt comments found.');
    if(d.comment_id && !matches.some(c=>String(c.id)===d.comment_id))throw ambiguous('Producer summary comment changed or disappeared.');
    if(!d.comment_id) {
      let comment=matches[0];
      if(!comment) {
        if(d.comment_started)throw ambiguous('Summary comment outcome is uncertain. No duplicate comment was created.');
        await checkpoint('comment-start');d.comment_started=true;
        await guard();
        comment=await cu.comment(LIST,taskId,`${marker}\n${outputs.map(o=>`${o.variation}. ${o.filename}: ${o.url}`).join('\n')}`);
      }
      if(!comment?.id)throw ambiguous('Summary comment could not be verified.');
      await checkpoint('comment',{id:String(comment.id)});d.comment_id=String(comment.id);
    }
    // Reverify every receipt before advancing the task, including resumed runs.
    const task=await guard();
    for(const output of outputs) {
      const attachment=task.attachments?.find(a=>String(a.id)===output.id);
      if(!attachment || imageHash(await download(attachmentUrl(attachment),0,signal))!==output.sha256)throw ambiguous('Final attachment verification failed. Task was not advanced.');
    }
    const verifiedComments=await cu.comments(LIST,taskId);
    if(!verifiedComments.some(c=>String(c.id)===d.comment_id && (c.comment_text || c.comment?.map(t=>t.text||'').join('') || '').includes(marker)))throw ambiguous('Summary comment readback failed.');
    await guard();
    await request(`v2/task/${taskId}`,'PUT',{status:'Ready to Launch'});
    const updated=await guard();
    if(String(updated.status?.status).toLowerCase()!=='ready to launch')throw new Error('ClickUp status verification failed.');
    await checkpoint('complete',{status:'Ready to Launch'});
  }
  return {prepare,deliver,finish};
}
