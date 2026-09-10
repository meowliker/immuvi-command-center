import { sql } from 'drizzle-orm'
import { db } from '../db/client'
import { keyToProduct } from '../lib/products'

const junk = (text: string) => text.trim().length < 20 || /^(thanks for watching|hi all|h all|hey all|bye|goodbye|subscribe|follow me|link in bio)/i.test(text.trim())
function lyric(text: string) {
  const t = text.toLowerCase(), words = t.split(/\s+/)
  return words.some((word,i) => {
    const pair = `${word} ${words[i+1] || ''}`
    return i < words.length-2 && pair.length>4 && (t.includes(`${pair}, ${pair}`) || t.split(pair).length>2)
  })
}
export async function loadHooks(product: string | null) {
  const list = product ? keyToProduct(product)!.listId : null
  const rows = await db.execute(sql`
    select distinct on(t.id) t.id,t.name,t.list_id,t.product_name,
      o.hook_text,tr.hook_spoken,o.observed_production_style as style,o.observed_creative_structure as structure,
      coalesce(nullif(trim(o.observed_angle_signal),''),nullif(trim(t.claimed_angle),''),'Unknown') as angle
    from strategist_tasks t join strategist_creatives c on c.task_id=t.id
    join strategist_observations o on o.creative_id=c.id
    left join strategist_transcripts tr on tr.creative_id=c.id
    where t.category in ('winner','mild_winner','scale') and t.duplicate_of_task_id is null
      and (${list}::text is null or t.list_id=${list})
    order by t.id,c.variant_index nulls first,c.id
  `)
  const groups = new Map<string, {angle:string; textMap:Map<string,string[]>; voiceoverMap:Map<string,string[]>}>()
  for (const row of rows) {
    if (/slideshow|animation|static.graphic|caption.only|caption.led|no.voiceover|sound.on|music\b|song/i.test(`${row.style || ''} ${row.structure || ''}`)) continue
    const key = `${row.list_id}:${row.angle}`
    const group = groups.get(key) || { angle: `${product ? '' : `${row.product_name} / `}${row.angle}`, textMap: new Map(),voiceoverMap:new Map() }
    for (const [text,map,spoken] of [[row.hook_text,group.textMap,false],[row.hook_spoken,group.voiceoverMap,true]] as const) {
      if (typeof text !== 'string' || junk(text) || (spoken && lyric(text))) continue
      const value=text.trim(); map.set(value,[...(map.get(value)||[]),String(row.name)])
    }
    groups.set(key,group)
  }
  const entries = (map:Map<string,string[]>) => [...map].map(([text,creatives])=>({text,creatives}))
  return [...groups.values()].map(g=>({angle:g.angle,textHooks:entries(g.textMap),voiceoverHooks:entries(g.voiceoverMap)}))
    .filter(g=>g.textHooks.length+g.voiceoverHooks.length>0)
    .sort((a,b)=>(b.textHooks.length+b.voiceoverHooks.length)-(a.textHooks.length+a.voiceoverHooks.length))
}
