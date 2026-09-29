-- Competitor research + strategist recommendations used by the command center.
-- This migration is intentionally idempotent because the original HTML app
-- shipped these contracts before they were represented in the repository.

alter table public.ads
  add column if not exists meta jsonb not null default '{}'::jsonb;

alter table public.inspirations
  add column if not exists data jsonb not null default '{}'::jsonb;

create table if not exists public.competitor_brands (
  id text primary key default ('cb-' || uuid_generate_v4()::text),
  product_id text not null references public.products(id) on delete cascade,
  name text not null,
  category text not null default 'direct',
  meta_page_id text,
  meta_ad_library_url text,
  homepage_url text,
  active_ad_count int,
  last_seen_at timestamptz,
  approved boolean not null default false,
  approved_at timestamptz,
  approved_by uuid,
  notes text,
  research_priority int,
  discovery_source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_competitor_brands_product
  on public.competitor_brands(product_id, approved, category);

create table if not exists public.competitor_research_queue (
  id text primary key default ('crq-' || uuid_generate_v4()::text),
  product_id text not null references public.products(id) on delete cascade,
  brand_id text references public.competitor_brands(id) on delete set null,
  job_type text not null,
  status text not null default 'pending',
  priority int not null default 0,
  payload jsonb not null default '{}'::jsonb,
  result_summary jsonb not null default '{}'::jsonb,
  claimed_by text,
  claimed_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  attempts int not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_competitor_queue_pending
  on public.competitor_research_queue(status, priority desc, created_at)
  where status in ('pending', 'claimed', 'running');

create index if not exists idx_competitor_queue_product
  on public.competitor_research_queue(product_id, created_at desc);

create table if not exists public.competitor_creatives (
  id text primary key default ('cc-' || uuid_generate_v4()::text),
  product_id text not null references public.products(id) on delete cascade,
  brand_id text references public.competitor_brands(id) on delete set null,
  external_id text,
  ad_url text,
  media_url text,
  thumbnail_url text,
  platform text,
  media_type text,
  hook text,
  angle text,
  persona text,
  format text,
  funnel_stage text,
  production_style text,
  visual_pattern text,
  copy_pattern text,
  body_copy text,
  offer text,
  why_it_works text,
  status_label text,
  rank_in_brand int,
  source_data jsonb not null default '{}'::jsonb,
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_competitor_creatives_product_brand
  on public.competitor_creatives(product_id, brand_id, rank_in_brand);

create table if not exists public.strategist_recommendations (
  id text primary key default ('sr-' || uuid_generate_v4()::text),
  product_id text not null references public.products(id) on delete cascade,
  source_creative_id text references public.competitor_creatives(id) on delete set null,
  recommendation_type text,
  confidence_band text,
  recommended_hook text,
  recommended_angle text,
  recommended_persona text,
  recommended_format text,
  reasoning text,
  status text not null default 'pending',
  rank int,
  metadata jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  rejection_reason text,
  inspiration_id text,
  ad_id text,
  manual_action_id uuid references public.manual_actions(id) on delete set null,
  task_id text,
  task_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_strategist_recommendations_product_status
  on public.strategist_recommendations(product_id, status, generated_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'competitor_brands',
    'competitor_research_queue',
    'competitor_creatives',
    'strategist_recommendations'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I_authed on public.%I', table_name, table_name);
    execute format(
      'create policy %I_authed on public.%I for all to authenticated using (public.has_product(product_id)) with check (public.has_product(product_id))',
      table_name,
      table_name
    );
  end loop;
end $$;

drop trigger if exists trg_competitor_brands_updated on public.competitor_brands;
create trigger trg_competitor_brands_updated
before update on public.competitor_brands
for each row execute function public.set_updated_at();

drop trigger if exists trg_competitor_research_queue_updated on public.competitor_research_queue;
create trigger trg_competitor_research_queue_updated
before update on public.competitor_research_queue
for each row execute function public.set_updated_at();

drop trigger if exists trg_competitor_creatives_updated on public.competitor_creatives;
create trigger trg_competitor_creatives_updated
before update on public.competitor_creatives
for each row execute function public.set_updated_at();

drop trigger if exists trg_strategist_recommendations_updated on public.strategist_recommendations;
create trigger trg_strategist_recommendations_updated
before update on public.strategist_recommendations
for each row execute function public.set_updated_at();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'competitor_brands',
    'competitor_research_queue',
    'competitor_creatives',
    'strategist_recommendations'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

create or replace function public.approve_strategist_recommendation(
  p_recommendation_id text,
  p_product_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  recommendation public.strategist_recommendations%rowtype;
  source_creative public.competitor_creatives%rowtype;
  v_angle_name text;
  v_persona_name text;
  v_angle_id text;
  v_persona_id text;
  v_inspiration_id text;
  v_ad_id text;
  v_action_db_id uuid;
  v_action_id text;
  v_source_url text;
  v_format_name text;
  v_ad_type text;
  v_now_ms bigint;
begin
  select * into recommendation
  from public.strategist_recommendations
  where id = p_recommendation_id
    and product_id = p_product_id
  for update;

  if not found then
    raise exception 'Strategist recommendation not found';
  end if;

  if recommendation.status = 'tasked' then
    return jsonb_build_object(
      'recommendation_id', recommendation.id,
      'inspiration_id', recommendation.inspiration_id,
      'ad_id', recommendation.ad_id,
      'manual_action_db_id', recommendation.manual_action_id,
      'task_id', recommendation.task_id,
      'already_tasked', true
    );
  end if;

  v_angle_name := nullif(trim(recommendation.recommended_angle), '');
  v_persona_name := nullif(trim(recommendation.recommended_persona), '');
  if v_angle_name is null or v_persona_name is null then
    raise exception 'Recommendation must include both an angle and a persona';
  end if;

  select id into v_angle_id
  from public.angles
  where product_id = p_product_id and lower(trim(name)) = lower(v_angle_name)
  order by created_at
  limit 1;

  if v_angle_id is null then
    v_angle_id := 'ang-strategist-' || substr(md5(p_product_id || ':' || v_angle_name), 1, 12);
    insert into public.angles (id, product_id, name, status, source_link, notes)
    values (v_angle_id, p_product_id, v_angle_name, 'Untested', '', 'From strategist recommendation')
    on conflict (id) do nothing;
  end if;

  select id into v_persona_id
  from public.personas
  where product_id = p_product_id and lower(trim(name)) = lower(v_persona_name)
  order by created_at
  limit 1;

  if v_persona_id is null then
    v_persona_id := 'per-strategist-' || substr(md5(p_product_id || ':' || v_persona_name), 1, 12);
    insert into public.personas (id, product_id, name, status, source_link, notes)
    values (v_persona_id, p_product_id, v_persona_name, 'Untested', '', 'From strategist recommendation')
    on conflict (id) do nothing;
  end if;

  if recommendation.source_creative_id is not null then
    select * into source_creative
    from public.competitor_creatives
    where id = recommendation.source_creative_id;
  end if;

  v_source_url := coalesce(source_creative.ad_url, '');
  v_format_name := coalesce(
    nullif(trim(recommendation.recommended_format), ''),
    nullif(trim(recommendation.recommended_hook), ''),
    'Strategist test'
  );
  v_ad_type := case when lower(v_format_name) like '%video%' then 'Video' else 'Photo' end;
  v_now_ms := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_inspiration_id := upper(regexp_replace(p_product_id, '[^a-zA-Z0-9]+', '-', 'g'))
    || '-INS-STRAT-' || substr(md5(recommendation.id), 1, 8);
  v_ad_id := upper(regexp_replace(p_product_id, '[^a-zA-Z0-9]+', '-', 'g'))
    || '-STRAT-' || substr(md5(recommendation.id), 1, 8);
  v_action_id := 'manual-strategist-' || substr(md5(recommendation.id), 1, 12);

  insert into public.inspirations (
    id, product_id, url, title, platform, added_by, status, data
  ) values (
    v_inspiration_id,
    p_product_id,
    v_source_url,
    v_format_name,
    'Other',
    auth.uid()::text,
    'Testing',
    jsonb_build_object(
      'id', v_inspiration_id,
      'sourceUrl', v_source_url,
      'formatName', v_format_name,
      'brand', 'From strategist',
      'angle', v_angle_name,
      'persona', v_persona_name,
      'hookType', case when recommendation.recommended_hook is not null then 'Custom' else '' end,
      'funnelStage', 'TOF',
      'adType', v_ad_type,
      'creativeUSP', coalesce(recommendation.reasoning, ''),
      'creativeHypothesis', coalesce(recommendation.reasoning, ''),
      'notes', 'Strategist recommendation',
      'addedAt', v_now_ms,
      'classifiedAt', v_now_ms,
      'importTags', jsonb_build_array('Strategist Recommendation', coalesce(recommendation.confidence_band, 'MEDIUM')),
      '_origin', 'strategist_recommendation',
      '_strategistRecId', recommendation.id
    )
  )
  on conflict (id) do update set
    title = excluded.title,
    status = excluded.status,
    data = excluded.data,
    updated_at = now();

  insert into public.ads (
    id, product_id, format_name, ad_link, ad_type, funnel_stage, status,
    angle, persona, ad_origin, meta
  ) values (
    v_ad_id,
    p_product_id,
    v_format_name,
    v_source_url,
    v_ad_type,
    'TOF',
    'Untested',
    v_angle_name,
    v_persona_name,
    'From Inspo',
    jsonb_build_object(
      'taskType', 'production',
      'hookType', coalesce(recommendation.recommended_hook, ''),
      'creativeUSP', coalesce(recommendation.reasoning, ''),
      'creativeHypothesis', coalesce(recommendation.reasoning, ''),
      '_fromInspoId', v_inspiration_id,
      '_sourceInsId', v_inspiration_id,
      '_sourceInspoUrl', v_source_url,
      '_sourceInspoAdUrl', v_source_url,
      '_origin', 'strategist_recommendation',
      '_strategistRecId', recommendation.id,
      'createdAt', v_now_ms,
      'dateCreated', v_now_ms
    )
  )
  on conflict (id) do update set
    format_name = excluded.format_name,
    ad_link = excluded.ad_link,
    angle = excluded.angle,
    persona = excluded.persona,
    meta = excluded.meta,
    updated_at = now();

  insert into public.matrix_cells (
    product_id, angle_id, persona_id, creative_assignments
  ) values (
    p_product_id, v_angle_id, v_persona_id, jsonb_build_array(v_ad_id)
  )
  on conflict (product_id, angle_id, persona_id) do update set
    creative_assignments = case
      when public.matrix_cells.creative_assignments @> jsonb_build_array(v_ad_id)
        then public.matrix_cells.creative_assignments
      else public.matrix_cells.creative_assignments || jsonb_build_array(v_ad_id)
    end,
    updated_at = now();

  insert into public.manual_actions (product_id, payload, live_status)
  values (
    p_product_id,
    jsonb_build_object(
      'id', v_action_id,
      'title', coalesce(nullif(trim(recommendation.recommended_hook), ''), v_format_name),
      'sourceAdId', v_ad_id,
      'adId', v_ad_id,
      'sourceAngle', v_angle_name,
      'sourcePersona', v_persona_name,
      'funnelStage', 'TOF',
      'format', v_ad_type,
      'liveStatus', 'Untested',
      'reason', 'Strategist recommendation',
      'tag', 'strategist',
      '_origin', 'strategist_recommendation',
      '_strategistRecId', recommendation.id,
      '_pushedBy', auth.uid()::text,
      '_pushedAt', v_now_ms
    ),
    'Untested'
  )
  returning id into v_action_db_id;

  update public.strategist_recommendations
  set status = 'tasked',
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      inspiration_id = v_inspiration_id,
      ad_id = v_ad_id,
      manual_action_id = v_action_db_id,
      task_id = v_action_id,
      task_created_at = now()
  where id = recommendation.id;

  return jsonb_build_object(
    'recommendation_id', recommendation.id,
    'angle_id', v_angle_id,
    'persona_id', v_persona_id,
    'inspiration_id', v_inspiration_id,
    'ad_id', v_ad_id,
    'manual_action_db_id', v_action_db_id,
    'manual_action_id', v_action_id,
    'task_id', v_action_id,
    'already_tasked', false
  );
end;
$$;

grant execute on function public.approve_strategist_recommendation(text, text) to authenticated;
