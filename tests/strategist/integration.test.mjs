import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {targetEnv} from '../../scripts/strategist-env.mjs';

test('analysis prompts and field comparison retain their original source hashes',async()=>{
  const manifest=JSON.parse(await readFile('strategist/source-manifest.json','utf8'));
  for(const file of manifest.files.filter(f=>f.path.startsWith('src/lib/analysis/'))){
    const value=await readFile(`strategist/${file.path}`);
    assert.equal(createHash('sha256').update(value).digest('hex'),file.sha256,file.path);
  }
});
test('Vercel root routing and skill downloads remain configured',async()=>{
  const config=JSON.parse(await readFile('vercel.json','utf8'));
  assert.ok(config.rewrites.some(r=>r.source==='/'&&r.destination==='/immuvi-command-center.html'));
  assert.ok(config.rewrites.some(r=>r.source==='/install-skill.sh'&&r.destination==='/team-skill/install-skill.sh'));
});
test('Strategist tab opens the new same-origin page',async()=>{
  const html=await readFile('immuvi-command-center.html','utf8');
  assert.match(html,/onclick="location\.href='\/strategist\.html'"/);
});
test('database configuration rejects a different Supabase project',()=>{
  const prior={SUPABASE_URL:process.env.SUPABASE_URL,STRATEGIST_DATABASE_URL:process.env.STRATEGIST_DATABASE_URL};
  try{
    process.env.SUPABASE_URL='https://expected-project.supabase.co';
    process.env.STRATEGIST_DATABASE_URL='postgresql://postgres:test@db.other-project.supabase.co:5432/postgres';
    assert.throws(()=>targetEnv(),/does not belong/);
  }finally{
    for(const [key,value] of Object.entries(prior))if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
});
test('new app has no shared-password gate and keeps the Immuvi session key',async()=>{
  const client=await readFile('strategist/src/browser/api.ts','utf8');
  assert.match(client,/storageKey:'immuvi-auth'/);
  const bundle=await readFile('strategist-assets/app.js','utf8');
  assert.doesNotMatch(bundle,/APP_PASSWORD|SUPABASE_SERVICE_ROLE_KEY|GOOGLE_SERVICE_ACCOUNT_JSON|STRATEGIST_DATABASE_URL/);
});
