import Anthropic from '@anthropic-ai/sdk';
import {google} from 'googleapis';
import postgres from 'postgres';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {targetEnv} from './strategist-env.mjs';
const env=targetEnv();
const report={};
let temporary;
const sql=postgres(env.STRATEGIST_DATABASE_URL,{prepare:false,max:1,ssl:'require',connect_timeout:15});
try{
  const [{n}]=await sql`select count(*)::int as n from strategist_tasks`;
  report.database={connected:true,tasks:n};
  const anthropic=new Anthropic({apiKey:env.ANTHROPIC_API_KEY});
  const models=await anthropic.models.list({limit:100});
  const ids=models.data.map(m=>m.id);
  report.models={blind:ids.includes('claude-sonnet-4-6'),synthesis:ids.includes('claude-opus-5')};
  if(!report.models.blind||!report.models.synthesis)throw new Error('A configured Strategist model is unavailable');
  const response=await fetch('https://api.clickup.com/api/v2/team',{headers:{Authorization:env.CLICKUP_TOKEN},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(`ClickUp credential check failed (${response.status})`);
  const teams=await response.json();
  report.clickup=teams.teams.some(t=>String(t.id)===env.CLICKUP_TEAM_ID);
  if(!report.clickup)throw new Error('ClickUp team is not accessible');
  let credentials;
  try{
    credentials=JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
    if(typeof credentials.client_email!=='string'||typeof credentials.private_key!=='string'||!credentials.private_key.includes('PRIVATE KEY'))throw new Error();
  }catch{throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is missing or invalid; provide the actual service-account JSON file');}
  const auth=new google.auth.JWT({email:credentials.client_email,key:credentials.private_key.replace(/\\n/g,'\n'),scopes:['https://www.googleapis.com/auth/drive.readonly']});
  const drive=google.drive({version:'v3',auth});
  const [file]=await sql`select c.source_file_id,t.name as task_name from strategist_creatives c join strategist_tasks t on t.id=c.task_id where c.source='drive' and c.mime_type like 'video/%' order by c.size_bytes asc nulls last,c.id limit 1`;
  if(!file)throw new Error('No imported Drive video is available for verification');
  const media=await drive.files.get({fileId:file.source_file_id,fields:'id,mimeType,size,capabilities(canDownload)',supportsAllDrives:true},{timeout:20000});
  report.drive={accessible:Boolean(media.data.id),mimeType:media.data.mimeType,canDownload:media.data.capabilities?.canDownload===true};
  if(!report.drive.canDownload)throw new Error('The service account can see the source video but does not have download permission');
  if(process.argv.includes('--video')){
    const limit=50*1024*1024;
    if(Number(media.data.size)>limit)throw new Error('The smallest source video exceeds the 50 MB verification limit');
    temporary=await mkdtemp(path.join(tmpdir(),'strategist-drive-check-'));
    const destination=path.join(temporary,'source-video');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),90000);
    let bytes=0;
    try{
      const download=await drive.files.get({fileId:file.source_file_id,alt:'media',supportsAllDrives:true},{responseType:'stream',signal:controller.signal});
      const bounded=new Transform({transform(chunk,encoding,callback){bytes+=chunk.length;callback(bytes>limit?new Error('Video exceeds verification size limit'):null,chunk);}});
      await pipeline(download.data,bounded,createWriteStream(destination,{mode:0o600}),{signal:controller.signal});
    }finally{clearTimeout(timer);}
    const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',destination],{encoding:'utf8',timeout:30000,env}));
    const video=probe.streams.find(stream=>stream.codec_type==='video');
    if(!video||!bytes)throw new Error('Downloaded source could not be verified as a video');
    report.video={task:file.task_name,downloadedBytes:bytes,durationSeconds:Number(probe.format.duration),width:video.width,height:video.height};
  }
  await mkdir('backups/strategist-verification',{recursive:true,mode:0o700});
  await writeFile('backups/strategist-verification/preflight-report.json',JSON.stringify({checkedAt:new Date().toISOString(),...report},null,2),{mode:0o600});
  console.log(JSON.stringify(report));
}catch(error){console.error(JSON.stringify({checks:report,error:error.message}));process.exitCode=1;}finally{if(temporary)await rm(temporary,{recursive:true,force:true});await sql.end();}
