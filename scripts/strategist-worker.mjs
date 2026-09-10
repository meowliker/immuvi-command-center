import postgres from 'postgres';
import { spawn,execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { createRequire } from 'node:module';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { targetEnv } from './strategist-env.mjs';

const require=createRequire(import.meta.url);
const env=targetEnv();
const sql=postgres(env.STRATEGIST_DATABASE_URL,{prepare:false,max:2,ssl:'require',connect_timeout:15,onnotice:()=>{}});
const workerId=`${hostname()}-${process.pid}`;
const scripts={sync:'sync.ts',watch:'backfill.ts',enrich:'enrich.ts',synthesize:'synthesize.ts',snapshot:'snapshot.ts'};
const products={hh:'Herbal Healing Handbook',ad:'ADHD',ca:'Canva Mastery',ig:'Instagram Growth Bundle',km:'Kids Mental Health',kl:'Kids Life Skill'};
let stopping=false,currentChild=null;
function killChild(signal='SIGTERM') {
  if(!currentChild?.pid)return;
  try{process.kill(-currentChild.pid,signal);}catch{}
}
process.on('SIGTERM',()=>{stopping=true;killChild();});
process.on('SIGINT',()=>{stopping=true;killChild();});

function safeLog(text) {
  let clean=text;
  for(const [key,value] of Object.entries(env)) if(/TOKEN|PASSWORD|SECRET|API_KEY|DATABASE_URL|SERVICE_ROLE/.test(key)&&value&&value.length>8)clean=clean.replaceAll(value,'[redacted]');
  return clean.replace(/postgres(?:ql)?:\/\/\S+/gi,'[database]').slice(0,1500);
}

async function runJob(job) {
  const token=job.lease_token;
  const logs=[];
  let cancelled=false,lostLease=false,forceKill=null,jobChild=null,heartbeatPromise=null;
  const stopJob=(signal='SIGTERM')=>{
    if(!jobChild?.pid)return;
    try{process.kill(-jobChild.pid,signal);}catch{}
  };
  const append=chunk=>{
    for(const line of String(chunk).split(/\r?\n/))if(line.trim())logs.push(safeLog(line.trim()));
    while(logs.length>80)logs.shift();
  };
  const heartbeat=async()=>{
    try{
      const rows=await sql`update strategist_jobs set heartbeat_at=now(),log=${sql.json(logs)} where id=${job.id} and lease_token=${token} and status='running' returning cancel_requested`;
      if(!rows.length){lostLease=true;stopJob();}
      else if(rows[0].cancel_requested||stopping){cancelled=true;stopJob();}
    }catch{lostLease=true;stopJob();}
    if((cancelled||lostLease)&&!forceKill)forceKill=setTimeout(()=>stopJob('SIGKILL'),10000);
  };
  const timer=setInterval(()=>{
    if(!heartbeatPromise)heartbeatPromise=heartbeat().finally(()=>{heartbeatPromise=null;});
  },5000);
  try{
    if(job.kind==='watch'){
      for(const command of ['ffmpeg','ffprobe'])execFileSync(command,['-version'],{stdio:'ignore',timeout:15000,env});
      execFileSync(env.STRATEGIST_WHISPER_PYTHON||env.STRATEGIST_WHISPER_BIN||'whisper',env.STRATEGIST_WHISPER_PYTHON?['-m','whisper','--help']:['--help'],{stdio:'ignore',timeout:15000,env});
    }
    const args=[require.resolve('tsx/cli'),path.resolve('strategist/src/scripts',scripts[job.kind])];
    if(job.product_key)args.push(`--product=${products[job.product_key]}`);
    if(job.kind==='enrich')args.push('--concurrency=2');
    const result=await new Promise(resolve=>{
      jobChild=currentChild=spawn(process.execPath,args,{cwd:path.resolve('strategist'),env:{...env,PG_POOL_MAX:'2'},stdio:['ignore','pipe','pipe'],detached:true});
      currentChild.stdout.on('data',append);currentChild.stderr.on('data',append);
      currentChild.on('error',error=>{append(error.message);resolve({code:1});});
      currentChild.on('close',code=>resolve({code:code??1}));
    });
    clearInterval(timer);
    if(heartbeatPromise)await heartbeatPromise;
    // A cancellation arriving just as the child exits still wins over success.
    await heartbeat();
    if(lostLease)return;
    const status=cancelled||stopping?'cancelled':result.code===0?'succeeded':'failed';
    await sql`update strategist_jobs set status=${status},finished_at=now(),heartbeat_at=now(),log=${sql.json(logs)},exit_code=${result.code},error=${status==='failed'?logs.at(-1)||'Job failed':null}
      where id=${job.id} and lease_token=${token} and status='running'`;
    console.log(`${job.kind}: ${status}`);
  }catch(error){
    append(error.message);
    if(!lostLease)await sql`update strategist_jobs set status='failed',finished_at=now(),log=${sql.json(logs)},error=${safeLog(error.message)} where id=${job.id} and lease_token=${token} and status='running'`;
  }finally{clearInterval(timer);if(heartbeatPromise)await heartbeatPromise;if(forceKill)clearTimeout(forceKill);currentChild=null;jobChild=null;}
}

try{
  console.log(`Strategist worker ${workerId} ready`);
  while(!stopping){
    try{
      const job=await sql.begin(async tx=>{
        await tx`select pg_advisory_xact_lock(hashtext('strategist-job-claim'))`;
        await tx`update strategist_jobs set status='cancelled',finished_at=now() where status='queued' and cancel_requested`;
        await tx`update strategist_jobs set status=case when attempts>=3 then 'failed' else 'queued' end,finished_at=case when attempts>=3 then now() else null end,error='Worker interrupted; resumable work retained',lease_token=null where status='running' and heartbeat_at<now()-interval '90 seconds'`;
        const [running]=await tx`select id from strategist_jobs where status='running' limit 1`;
        if(running)return null;
        const [next]=await tx`select id from strategist_jobs where status='queued' and not cancel_requested order by created_at for update skip locked limit 1`;
        if(!next)return null;
        const [claimed]=await tx`update strategist_jobs set status='running',started_at=now(),heartbeat_at=now(),worker_id=${workerId},attempts=attempts+1,lease_token=${randomUUID()} where id=${next.id} returning *`;
        return claimed;
      });
      if(job)await runJob(job);else if(!process.argv.includes('--once'))await delay(3000);
      if(process.argv.includes('--once'))break;
    }catch(error){console.error('Worker connection retry:',error.code||error.name);if(process.argv.includes('--once'))throw error;await delay(5000);}
  }
}finally{await sql.end({timeout:5});}
