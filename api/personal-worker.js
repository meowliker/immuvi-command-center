import {createHash,randomBytes} from 'node:crypto';
import {PersonalWorkerError,validatePersonalResult,briefContentMatches} from '../tools/personal-worker-result.mjs';
const digest=value=>createHash('sha256').update(value).digest('hex');
const secret=()=>randomBytes(32).toString('base64url');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const browserOps=new Set(['create','list','revoke','enqueue','retry']);
export function createPersonalWorkerHandler({fetchImpl=fetch,env=process.env}={}) {
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    if(req.method!=='POST') return res.status(405).json({error:'Use POST'});
    try {
      const url=env.SUPABASE_URL,key=env.SUPABASE_SERVICE_ROLE_KEY;
      if(!url||!key) throw new PersonalWorkerError('Personal worker service is not configured',503);
      let body;
      try {body=typeof req.body==='string'?JSON.parse(req.body):req.body;} catch {throw new PersonalWorkerError('Invalid request');}
      if(!body||JSON.stringify(body).length>350000) throw new PersonalWorkerError('Invalid request size');
      const op=body.op;
      const call=async (address,options={})=>{
        const r=await fetchImpl(address,{...options,signal:AbortSignal.timeout(12000)});
        let data; try{data=await r.json();}catch{throw new PersonalWorkerError('Service returned an invalid response',502);}
        if(!r.ok) throw new PersonalWorkerError(r.status===429?'Service rate limit; wait before retrying':
          'Service could not confirm this request',r.status===401?401:r.status===403?403:r.status===429?429:502);
        return data;
      };
      const rpc=async (operation,args)=>{
        const r=await fetchImpl(url+'/rest/v1/rpc/personal_worker_dispatch',{method:'POST',
          headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},
          body:JSON.stringify({p_op:operation,p_args:args}),signal:AbortSignal.timeout(15000)});
        const data=await r.json();
        if(!r.ok) throw new PersonalWorkerError(['42501','PT409','PT429','22023'].includes(data.code)?data.message:
          'Personal worker request could not be confirmed',data.code==='42501'?403:data.code==='PT409'?409:data.code==='PT429'?429:502);
        return data;
      };
      const clickupKey=req.headers['x-clickup-key'];
      const clickupIdentity=async ()=>{
        if(typeof clickupKey!=='string'||!/^pk_[A-Za-z0-9_]{15,180}$/.test(clickupKey)) throw new PersonalWorkerError('Enter your own ClickUp personal key',401);
        const account=await call('https://api.clickup.com/api/v2/user',{headers:{Authorization:clickupKey}});
        if(!Number.isSafeInteger(account.user?.id)||account.user.id<=0) throw new PersonalWorkerError('ClickUp identity could not be verified',401);
        return String(account.user.id);
      };
      if(browserOps.has(op)) {
        const auth=req.headers.authorization;
        if(typeof auth!=='string'||!/^Bearer [^\s]+$/.test(auth)) throw new PersonalWorkerError('Sign in first',401);
        const user=await call(url+'/auth/v1/user',{headers:{apikey:key,Authorization:auth}});
        if(!uuid.test(user.id)) throw new PersonalWorkerError('Sign in again',401);
        const args={owner_id:user.id,clickup_user_id:await clickupIdentity()};
        if(op==='create') {
          if(typeof body.name!=='string'||body.name.trim().length<1||body.name.length>80) throw new PersonalWorkerError('Enter a Mac name (maximum 80 characters)');
          const pairing=secret();
          const created=await rpc(op,{...args,name:body.name.trim(),pair_hash:digest(pairing)});
          return res.status(200).json({...created,pairingCode:created.id+'.'+pairing});
        }
        if(op!=='list') {
          if(!uuid.test(body.deviceId)) throw new PersonalWorkerError('Select your paired Mac');
          args.device_id=body.deviceId;
        }
        if(op==='enqueue') {
          if(typeof body.productId!=='string'||body.productId.length>200||!Array.isArray(body.items)||!body.items.length||body.items.length>20) throw new PersonalWorkerError('Select up to 20 inspirations in one product');
          args.product_id=body.productId;
          args.items=body.items.map(it=>{
            if(typeof it.id!=='string'||!it.id||it.id.length>200||typeof it.url!=='string'||it.url.length>4000||typeof it.no_brief!=='boolean') throw new PersonalWorkerError('Invalid inspiration assignment');
            const source=new URL(it.url); if(source.protocol!=='https:') throw new PersonalWorkerError('Only HTTPS source links are supported');
            return {id:it.id,url:it.url,no_brief:it.no_brief};
          });
        }
        if(op==='retry') {
          if(!uuid.test(body.jobId)) throw new PersonalWorkerError('Select a blocked personal job');
          args.job_id=body.jobId;
        }
        return res.status(200).json(await rpc(op,args));
      }
      if(op==='pair') {
        const parts=typeof body.code==='string'?body.code.split('.'):[];
        if(parts.length!==2||!uuid.test(parts[0])||!/^[A-Za-z0-9_-]{43}$/.test(parts[1])) throw new PersonalWorkerError('Invalid pairing code');
        const token=secret();
        await rpc('pair',{device_id:parts[0],pair_hash:digest(parts[1]),token_hash:digest(token),clickup_user_id:await clickupIdentity()});
        return res.status(200).json({token});
      }
      if(!['heartbeat','claim','fail','complete'].includes(op)) throw new PersonalWorkerError('Unknown operation');
      const deviceAuth=req.headers.authorization||'';
      if(!/^Device [A-Za-z0-9_-]{43}$/.test(deviceAuth)) throw new PersonalWorkerError('Pair this Mac first',401);
      const args={token_hash:digest(deviceAuth.slice(7)),contract:'personal-artifact-v1'};
      if(op==='heartbeat'||op==='claim') return res.status(200).json(await rpc(op,args));
      if(!uuid.test(body.jobId)||!uuid.test(body.lease)) throw new PersonalWorkerError('Invalid job lease');
      Object.assign(args,{job_id:body.jobId,lease:body.lease});
      if(op==='fail') {
        const codes=['SOURCE_UNAVAILABLE','EVIDENCE_UNVERIFIED','LOCAL_TOOL_UNAVAILABLE','PROVIDER_UNAVAILABLE','AGENT_FAILED','TIMEOUT'];
        if(!codes.includes(body.code)) throw new PersonalWorkerError('Invalid failure code');
        return res.status(200).json(await rpc('fail',{...args,code:body.code}));
      }
      const context=await rpc('inspect',args);
      if(context.done) return res.status(200).json({done:true});
      const artifact=validatePersonalResult(body.result,context);
      const hash=digest(JSON.stringify(artifact));
      if(!context.no_brief && await clickupIdentity()!==context.clickup_user_id) throw new PersonalWorkerError('Use the ClickUp key that paired this Mac',403);
      const reserved=await rpc('prepare',{...args,artifact,artifact_hash:hash});
      if(reserved.done) return res.status(200).json({done:true});
      try {
      if(reserved.publishing) {
        if(reserved.artifactHash!==hash||!reserved.page) throw new PersonalWorkerError('Publishing needs review; no duplicate brief will be created',409);
      } else if(!reserved.noBrief) {
        if(!/^[A-Za-z0-9_-]{1,100}$/.test(reserved.docId||'')) throw new PersonalWorkerError('The product needs its Inspiration Library configured. Analysis is preserved.',409);
        const base='https://api.clickup.com/api/v3/workspaces/9016762494/docs/'+encodeURIComponent(reserved.docId)+'/pages';
        // Never update an existing page by task name/number. At most one create
        // is attempted per reserved job; ambiguous responses require review.
        const page=await call(base,{method:'POST',headers:{Authorization:clickupKey,'Content-Type':'application/json'},
          body:JSON.stringify({name:reserved.insId+' | '+artifact.patch.formatName,content:artifact.markdown,content_format:'text/md'})});
        if(typeof page.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(page.id)) throw new PersonalWorkerError('Brief creation needs review',502);
        const check=await call(base+'/'+encodeURIComponent(page.id)+'?content_format=text%2Fmd',{headers:{Authorization:clickupKey}});
        if(check.id!==page.id||!briefContentMatches(check.content,artifact.markdown)) throw new PersonalWorkerError('Brief readback needs review; no duplicate will be created',502);
        await rpc('page',{...args,page:{id:page.id,docId:reserved.docId,url:'https://app.clickup.com/9016762494/docs/'+reserved.docId+'/'+page.id}});
      }
      return res.status(200).json(await rpc('commit',{...args,artifact_hash:hash}));
      } catch(error) {
        // A reserved create is never automatically repeated after an ambiguous
        // response. Keep both the artifact and any existing page for review.
        try {await rpc('review',args);} catch {}
        throw error;
      }
    } catch(error) {
      // Never log tokens, URLs, evidence or upstream bodies in this public app.
      const status=error instanceof PersonalWorkerError?error.status:503;
      return res.status(status).json({error:error instanceof PersonalWorkerError?error.message:'Personal worker service is temporarily unavailable. Saved records were not reset.'});
    }
  };
}
export default createPersonalWorkerHandler();
