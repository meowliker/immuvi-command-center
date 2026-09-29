import test from 'node:test';
import assert from 'node:assert/strict';
import { producerSuggestions,producerBrief,producerInstruction,imageWorkerOnline } from '../../lib/domain/image-producer.js';
import { nativeEnvironment,publicAddress } from '../../scripts/qa-native-image-runner.mjs';
test('legacy suggestions stay product-local, rank persona evidence and never mutate source ads',()=>{
  const now=Date.now(),target={id:'target',productId:'qa',persona:'Parents'};
  const base={productId:'qa',status:'Winner',adType:'Photo',productionStyle:'UGC',updatedAt:now};
  const ads=[{...base,id:'other',persona:'Other'},{...base,id:'same',persona:'Parents'},{...base,id:'foreign',productId:'production'}, {...base,id:'video',adType:'Video'}, {...base,id:'deleted',deletedAt:'yes'}];
  const copy=structuredClone(ads);
  const result=producerSuggestions(ads,target,{creative_direction_layer:{production_styles:[{name:'UGC',wins:3,losses:1}]}},now);
  assert.deepEqual(result.map(r=>r.id),['same','other']);assert.deepEqual(ads,copy);
  assert.ok(result[0].reasons.includes('Same persona'));
});
test('worker receives creative context, not connection metadata',()=>{
  const brief=producerBrief({format_name:'QA',meta:{creativeHypothesis:'Brief',secret:'no',_clickupToken:'private'}});
  assert.equal(brief.creativeHypothesis,'Brief');assert.equal(JSON.stringify(brief).includes('private'),false);
  assert.match(producerInstruction({productName:'AstroRekha',instruction:'Keep CTA'}),/CANONICAL PRODUCT NAME: AstroRekha/);
  assert.match(producerInstruction({productName:'AstroRekha'}),/Variation 1 must be reference-faithful/);
  assert.deepEqual(nativeEnvironment({HOME:'/home',PATH:'/bin',SUPABASE_SERVICE_ROLE_KEY:'secret',CLICKUP_API_KEY:'secret',OPENAI_API_KEY:'secret'}),{HOME:'/home',PATH:'/bin'});
});
test('worker readiness expires and reference downloads reject private destinations',()=>{
  const now=Date.now();assert.equal(imageWorkerOnline({generation_available:true,heartbeat_at:new Date(now).toISOString()},now),true);
  assert.equal(imageWorkerOnline({generation_available:true,heartbeat_at:new Date(now-46000).toISOString()},now),false);
  for(const address of ['127.0.0.1','10.0.0.1','169.254.169.254','172.31.1.2','192.168.1.1','::1','::ffff:127.0.0.1','fd00::1','100.64.1.1','2002:7f00:1::'])assert.equal(publicAddress(address),false,address);
  assert.equal(publicAddress('8.8.8.8'),true);
});
