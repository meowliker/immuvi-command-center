import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSharedWorkerConfig,assertInspirationJob} from '../../lib/services/shared-worker.js';
import {QA_SUPABASE_URL,QA_SUPABASE_ANON_KEY} from '../../lib/qa-supabase-env.js';
const config={version:1,environment:'qa',url:QA_SUPABASE_URL,anonKey:QA_SUPABASE_ANON_KEY,
 id:'00000000-0000-4000-8000-000000000083',ownerId:'00000000-0000-4000-8000-000000000081',token:'a'.repeat(64),codexBin:'/bin/codex',
 scope:'shared',productId:'qa-sample-astrorekha',concurrency:1,runtimeHome:'/isolated/home',pythonBin:'/isolated/python/bin/python',deliveryPrivateKey:'fixture'};
const job={id:'job',worker_id:config.id,requested_by:'permitted-second-user',product_id:config.productId,status:'running',lease_id:'lease',
 context:{listId:'1301130000002447',libraryDocId:'8cq1r3y-44896',libraryTrackerPageId:'8cq1r3y-118036'}};
test('shared pairing is explicitly QA scoped and one slot',()=>{
 assert.equal(validateSharedWorkerConfig(config),config);
 for(const patch of [{scope:'private'},{productId:'production'},{concurrency:2},{runtimeHome:''},{pythonBin:''},{deliveryPrivateKey:''},{url:'https://hdniumnkprkadlrrataz.supabase.co'}])assert.throws(()=>validateSharedWorkerConfig({...config,...patch}));
});
test('shared runtime accepts leased product-user jobs only at exact QA destinations',()=>{
 assertInspirationJob(config,job);
 for(const patch of [{worker_id:'private-id'},{product_id:'foreign'},{status:'pending'},{lease_id:null},{context:{...job.context,libraryDocId:'production-library'}}])assert.throws(()=>assertInspirationJob(config,{...job,...patch}));
 assert.throws(()=>assertInspirationJob({...config,scope:'private'},job));
 assertInspirationJob({...config,scope:'private'},{...job,requested_by:config.ownerId});
});
