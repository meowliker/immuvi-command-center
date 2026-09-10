import { sql } from 'drizzle-orm'
import { db, withUser } from '../db/client'
import { PRODUCTS, keyToProduct } from '../lib/products'
import { projectSnapshot } from '../lib/data/project'
import { selectProduct } from '../lib/data/select'
import { loadResearch, loadSynthesis, loadCombinations } from '../lib/data/research'
import { loadHooks } from './hooks'

const KINDS = new Set(['sync', 'watch', 'enrich', 'snapshot', 'synthesize'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
class HttpError extends Error { constructor(public status: number, message: string) { super(message) } }

async function authenticate(req: any) {
  const token = String(req.headers.authorization || '').match(/^Bearer (.+)$/i)?.[1]
  if (!token) throw new HttpError(401, 'Sign in to Immuvi to continue.')
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new HttpError(503, 'Strategist server configuration is incomplete.')
  const headers = { apikey: key, Authorization: `Bearer ${token}` }
  const userRes = await fetch(`${url}/auth/v1/user`, { headers, signal: AbortSignal.timeout(15000) })
  if (!userRes.ok) throw new HttpError(401, 'Your Immuvi session has expired.')
  const user = await userRes.json() as { id: string }
  const profileRes = await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role,is_active,full_name`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000),
  })
  if (!profileRes.ok) throw new HttpError(503, 'Unable to verify Immuvi access.')
  const [profile] = await profileRes.json() as { role: string; is_active: boolean; full_name: string }[]
  if (!profile?.is_active) throw new HttpError(403, 'Your Immuvi account is inactive.')
  return { id: user.id, isAdmin: profile.role === 'admin', name: profile.full_name }
}

async function creativeDetail(id: string) {
  if (!id || id.length > 300) throw new HttpError(400, 'A valid creative ID is required.')
  const rows = await db.execute(sql`
    select c.*, t.id as task_id,t.name as task_name,t.url as task_url,
      t.product_name,t.category::text as category,t.editor,t.changed_lever,t.notes,t.drive_link,t.inspiration_link,
      t.claimed_angle,t.claimed_persona,t.claimed_funnel,t.claimed_ad_type,t.claimed_hook_type,
      t.claimed_creative_structure,t.claimed_production_style,t.claimed_usp,t.hypothesis as claimed_hypothesis,
      o.observed_angle_signal,o.observed_persona_signal,o.observed_funnel,o.observed_ad_type,
      o.observed_hook_type,o.observed_creative_structure,o.observed_production_style,
      o.hook_text,o.cta_text,o.pain_points,o.confidence,o.evidence,
      r.format_description,r.hook_mechanism,r.core_concept,r.creative_hypothesis,r.offer,r.offer_mechanism,
      r.script_arc,r.scenes,r.tactile_elements,r.repurposed_signals,r.source_handle,
      tr.text as transcript,tr.segments,tr.hook_spoken,
      (select jsonb_object_agg(v.field,jsonb_build_object('verdict',v.verdict::text,
        'claimed',v.claimed_value,'observed',v.observed_value,'confidence',v.confidence,
        'evidence',v.evidence,'resolved',coalesce(v.human_override,v.resolved_value)))
        from strategist_verdicts v where v.creative_id=c.id) as verdicts,
      (select jsonb_agg(jsonb_build_object('term',k.term,'kind',k.kind))
        from strategist_keywords k where k.creative_id=c.id) as keywords,
      (select jsonb_agg(to_jsonb(f) order by f.t_sec) from strategist_frame_texts f where f.creative_id=c.id) as frame_texts
    from strategist_creatives c join strategist_tasks t on t.id=c.task_id
    left join strategist_observations o on o.creative_id=c.id
    left join strategist_research r on r.creative_id=c.id
    left join strategist_transcripts tr on tr.creative_id=c.id
    where c.id=${id} limit 1
  `)
  if (!rows.length) throw new HttpError(404, 'Creative not found or unavailable to your account.')
  const row = rows[0]
  const file = row.source === 'drive' && /^[A-Za-z0-9_-]+$/.test(String(row.source_file_id)) ? row.source_file_id : null
  return { ...row, previewUrl: file ? `https://drive.google.com/file/d/${file}/preview` : null, watchUrl: file ? `https://drive.google.com/file/d/${file}/view` : null }
}

async function jobStatus(product: string | null) {
  const selected = product ? keyToProduct(product) : null
  const jobs = await db.execute(sql`select * from strategist_jobs
    where (${product}::text is null or product_key=${product}) order by created_at desc limit 30`)
  const rows = await db.execute(sql`
    select t.list_id,
      count(distinct t.id) filter(where t.drive_link is not null and not exists(
        select 1 from strategist_creatives c join strategist_observations o on o.creative_id=c.id where c.task_id=t.id))::int as to_watch,
      count(distinct c.id) filter(where c.id is not null and not exists(
        select 1 from strategist_research r where r.creative_id=c.id))::int as to_enrich
    from strategist_tasks t left join strategist_creatives c on c.task_id=t.id
    where t.category in ('winner','mild_winner','scale') and t.duplicate_of_task_id is null
      and (${selected?.listId ?? null}::text is null or t.list_id=${selected?.listId ?? null})
    group by t.list_id
  `)
  return { jobs, pending: rows.reduce<{toWatch:number;toEnrich:number}>((a,r) => ({ toWatch: a.toWatch + Number(r.to_watch), toEnrich: a.toEnrich + Number(r.to_enrich) }), { toWatch: 0, toEnrich: 0 }) }
}

async function enqueue(body: any, user: {id: string;isAdmin: boolean}) {
  const product = body.product || null
  if (product && !keyToProduct(product)) throw new HttpError(400, 'Unknown product.')
  if (!product && !user.isAdmin) throw new HttpError(403, 'Select one of your assigned products.')
  if (!KINDS.has(body.kind) || !UUID.test(body.requestId || '')) throw new HttpError(400, 'Invalid job request.')
  const rows = await db.execute(sql`
    insert into strategist_jobs(request_id,kind,product_key,requested_by)
    values(${body.requestId}::uuid,${body.kind},${product},${user.id}::uuid)
    on conflict do nothing returning *
  `)
  if (rows.length) return rows[0]
  const [existing] = await db.execute(sql`select * from strategist_jobs where requested_by=${user.id}::uuid and request_id=${body.requestId}::uuid`)
  if (existing) return existing
  throw new HttpError(409, 'This job is already queued or running for the product.')
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Vary', 'Authorization')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  try {
    const url = new URL(req.url, 'http://localhost')
    const op = url.searchParams.get('op') || 'snapshot'
    if (op === 'config' && req.method === 'GET') {
      const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!process.env.SUPABASE_URL || !anon) throw new HttpError(503, 'Strategist server configuration is incomplete.')
      return res.status(200).json({ url: process.env.SUPABASE_URL, anonKey: anon })
    }
    if (!['GET','POST'].includes(req.method)) throw new HttpError(405, 'Method not allowed.')
    const user = await authenticate(req)
    const product = url.searchParams.get('product') || null
    if (product && !keyToProduct(product)) throw new HttpError(400, 'Unknown product.')
    const result = await withUser(user.id, async () => {
      if (product) {
        const [scope] = await db.execute(sql`select public.strategist_can_read_list(${keyToProduct(product)!.listId}) as allowed`)
        if (!scope?.allowed) throw new HttpError(403, 'This product is not assigned to your account.')
      }
      if (req.method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
        if (op === 'jobs') return enqueue(body, user)
        if (op === 'cancel') {
          if (!UUID.test(body.id || '')) throw new HttpError(400, 'Invalid job ID.')
          const rows = await db.execute(sql`update strategist_jobs set cancel_requested=true
            where id=${body.id}::uuid and status in ('queued','running') returning id`)
          if (!rows.length) throw new HttpError(404, 'Active job not found.')
          return { requested: true }
        }
        throw new HttpError(404, 'Unknown operation.')
      }
      if (op === 'session') {
        const products = []
        for (const p of PRODUCTS) {
          const [scope] = await db.execute(sql`select public.strategist_can_read_list(${p.listId}) as allowed,
            (select id from products where config->>'clickup_list_id'=${p.listId} limit 1) as immuvi_id`)
          if (scope.allowed) products.push({ ...p, immuviId: scope.immuvi_id })
        }
        return { user, products }
      }
      if (op === 'snapshot') return selectProduct(await projectSnapshot(), product as any || 'all')
      if (op === 'creative') return creativeDetail(url.searchParams.get('id') || '')
      if (op === 'research') {
        const scope = product as any || 'all'
        const [cards,syntheses,combos] = await Promise.all([loadResearch(scope),loadSynthesis(scope),loadCombinations(scope)])
        return { cards,syntheses,combos }
      }
      if (op === 'hooks') return loadHooks(product)
      if (op === 'jobs') return jobStatus(product)
      throw new HttpError(404, 'Unknown operation.')
    })
    return res.status(200).json(result)
  } catch (error: any) {
    const status = error instanceof HttpError ? error.status : error.code === '42501' ? 403 : 500
    // Database details may include connection metadata or SQL; keep the response generic.
    console.error('[strategist]', error.name, error.code || error.cause?.code || '',
      error instanceof HttpError ? error.message : String(error.message).replace(/postgres(?:ql)?:\/\/\S+/gi, '[database]'))
    return res.status(status).json({ error: status === 500 ? 'Strategist could not load this request. Please retry.' : status === 403 && !(error instanceof HttpError) ? 'You do not have access to this operation.' : error.message })
  }
}
