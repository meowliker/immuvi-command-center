import assert from 'node:assert/strict'
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises'
import {createHash,randomUUID} from 'node:crypto'
import postgres from 'postgres'
// @ts-ignore local Node utility
import {targetEnv} from './strategist-env.mjs'

Object.assign(process.env,targetEnv())
const direct=postgres(process.env.STRATEGIST_DATABASE_URL!,{max:1,prepare:false,ssl:'require',onnotice:()=>{}})
const {withUser,db}=await import('../strategist/src/db/client')
const {sql}=await import('drizzle-orm')
const {default:handler}=await import('../strategist/src/server/handler')
const {PRODUCTS}=await import('../strategist/src/lib/products')
const report:any={checks:[],products:[]}
const realFetch=globalThis.fetch
let actor=''
globalThis.fetch=(async(input:any,init:any)=>{
  const url=String(input)
  if(url.endsWith('/auth/v1/user')&&init?.headers?.Authorization==='Bearer local-verification-only') {
    return new Response(JSON.stringify({id:actor}),{status:200,headers:{'Content-Type':'application/json'}})
  }
  return realFetch(input,init)
}) as typeof fetch
async function call(op:string,query:Record<string,string>={},body?:unknown,anonymous=false) {
  let status=200,data:any
  const res={setHeader(){},status(value:number){status=value;return this},json(value:any){data=value;return this}}
  await handler({url:`/api/strategist?${new URLSearchParams({op,...query})}`,method:body?'POST':'GET',headers:anonymous?{}:{authorization:'Bearer local-verification-only'},body},res)
  return {status,data}
}
try {
  const admins=await direct`select id from profiles where role='admin' and is_active order by created_at limit 1`
  assert.ok(admins[0],'An active admin is required for scoped verification')
  actor=admins[0].id
  const config=await call('config',{},undefined,true)
  assert.equal(config.status,200)
  assert.notEqual(config.data.anonKey,process.env.SUPABASE_SERVICE_ROLE_KEY)
  assert.equal((await call('snapshot',{},undefined,true)).status,401)
  report.checks.push('API rejects anonymous data access; config contains only public credentials')
  const session=await call('session')
  assert.equal(session.status,200,JSON.stringify(session.data))
  assert.equal(session.data.products.length,PRODUCTS.length)
  const all=await call('snapshot')
  assert.equal(all.status,200,JSON.stringify(all.data))
  await mkdir('backups/strategist-verification',{recursive:true,mode:0o700})
  await writeFile('backups/strategist-verification/session.json',JSON.stringify(session.data),{mode:0o600})
  await writeFile('backups/strategist-verification/snapshot-all.json',JSON.stringify(all.data),{mode:0o600})
  for(const p of PRODUCTS){
    const snapshot=await call('snapshot',{product:p.key})
    assert.equal(snapshot.status,200)
    assert.ok(snapshot.data.creatives.every((c:any)=>c.product===p.key))
    const research=await call('research',{product:p.key})
    assert.equal(research.status,200,JSON.stringify(research.data))
    assert.ok(research.data.cards.every((c:any)=>c.product===p.key))
    const allowedIds=new Set(snapshot.data.creatives.map((c:any)=>c.creativeId).filter(Boolean))
    for(const combo of [...research.data.combos.bets,...research.data.combos.dying])assert.ok(combo.creativeIds.every((id:string)=>allowedIds.has(id)),'Cross-product combination')
    assert.ok(research.data.syntheses.every((s:any)=>s.productKey===p.key))
    const hooks=await call('hooks',{product:p.key})
    assert.equal(hooks.status,200)
    const jobs=await call('jobs',{product:p.key})
    assert.equal(jobs.status,200)
    for(const [name,data] of [['snapshot',snapshot.data],['research',research.data],['hooks',hooks.data],['jobs',jobs.data]])await writeFile(`backups/strategist-verification/${name}-${p.key}.json`,JSON.stringify(data),{mode:0o600})
    report.products.push({key:p.key,...snapshot.data.totals,research:research.data.cards.length,hookGroups:hooks.data.length})
  }
  report.checks.push('All six products scoped independently across snapshots, research, synthesis, combinations, hooks and jobs')
  const first=all.data.creatives.find((c:any)=>c.creativeId)
  const detail=await call('creative',{id:first.creativeId})
  assert.equal(detail.status,200)
  assert.equal(detail.data.task_id,first.taskId)
  await writeFile('backups/strategist-verification/detail.json',JSON.stringify(detail.data),{mode:0o600})
  assert.equal((await call('snapshot',{product:'not-a-product'})).status,400)
  const members=await direct`select id from profiles where role='member' and is_active order by created_at`
  for(const member of members){
    actor=member.id
    const response=await call('session')
    assert.equal(response.status,200)
    const allowed=new Set(response.data.products.map((p:any)=>p.key))
    const snapshot=await call('snapshot')
    assert.equal(snapshot.status,200)
    assert.ok(snapshot.data.creatives.every((c:any)=>allowed.has(c.product)))
    const denied=PRODUCTS.find(p=>!allowed.has(p.key))
    if(denied)assert.equal((await call('snapshot',{product:denied.key})).status,403)
    const foreign=all.data.creatives.find((c:any)=>c.creativeId&&!allowed.has(c.product))
    if(foreign)assert.equal((await call('creative',{id:foreign.creativeId})).status,404)
  }
  report.checks.push(`Member access boundaries verified for ${members.length} active members`)
  await withUser(randomUUID(),async()=>{
    const rows=await db.execute(sql`select count(*)::int as n from strategist_tasks`)
    assert.equal(rows[0].n,0)
  })
  report.checks.push('Unknown users have zero database visibility')
  const policies=await direct`select tablename,policyname from pg_policies where tablename like 'strategist_%'`
  report.checks.push(`${policies.length} Strategist RLS policies present`)
  const sourceBackups=(await readdir('backups')).filter(f=>f.startsWith('strategist-migration-')).sort().reverse()
  for(const folder of sourceBackups){
    const manifest=JSON.parse(await readFile(`backups/${folder}/manifest.json`,'utf8'))
    if(!manifest.applied)continue
    function stable(value:any):any{if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));return value}
    for(const table of Object.values(manifest.tables) as any[]){
      const rows=(await direct`select to_jsonb(t) as row from ${direct('public.'+table.target)} t`).map(r=>r.row)
      const hash=createHash('sha256').update(rows.map(row=>JSON.stringify(stable(row))).sort().join('\n')).digest('hex')
      assert.equal(hash,table.sha256,`Post-import checksum: ${table.target}`)
    }
    report.checks.push('All imported table checksums still match the original backup')
    break
  }
  await writeFile('backups/strategist-verification/report.json',JSON.stringify(report,null,2),{mode:0o600})
  console.log(JSON.stringify(report,null,2))
} finally {globalThis.fetch=realFetch;await direct.end();await (globalThis as any).__strategistSql?.end()}
