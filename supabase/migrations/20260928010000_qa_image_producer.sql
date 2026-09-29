-- Separate from producer_runs so a legacy worker can never claim a QA image job.
create table if not exists public.qa_image_runs (
  id uuid primary key,
  product_id text not null references public.products(id) on delete cascade,
  ad_id text not null,
  requested_by uuid not null references auth.users(id),
  status text not null default 'pending' check(status in ('pending','running','done','failed')),
  request jsonb not null,
  outputs jsonb not null default '[]',
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create unique index if not exists qa_image_one_active on public.qa_image_runs(product_id,ad_id) where status in ('pending','running');
create table if not exists public.qa_image_worker (
  id text primary key check(id='local-native'),
  heartbeat_at timestamptz not null,
  generation_available boolean not null default false
);
alter table public.qa_image_runs enable row level security;
alter table public.qa_image_worker enable row level security;
revoke all on public.qa_image_runs,public.qa_image_worker from public,anon,authenticated;
grant select on public.qa_image_runs,public.qa_image_worker to authenticated;
grant all on public.qa_image_runs,public.qa_image_worker to service_role;
drop policy if exists qa_images_read on public.qa_image_runs;
create policy qa_images_read on public.qa_image_runs for select to authenticated using(public.has_product(product_id));
drop policy if exists qa_image_worker_read on public.qa_image_worker;
create policy qa_image_worker_read on public.qa_image_worker for select to authenticated using(exists(select 1 from public.profiles where id=auth.uid() and is_active and not must_change_password));

create or replace function public.qa_generate_images(p_request_id uuid,p_product_id text,p_ad_id text,p_options jsonb)
returns public.qa_image_runs language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.ads%rowtype; result public.qa_image_runs%rowtype; refs jsonb; defaults jsonb; n integer; k text;
begin
  perform public.qa_tracker_access(p_product_id);
  select * into result from public.qa_image_runs where id=p_request_id;
  if found then
    if result.product_id<>p_product_id or result.ad_id<>p_ad_id or result.requested_by<>auth.uid() then raise exception 'Request identity conflict'; end if;
    return result;
  end if;
  if not exists(select 1 from public.qa_image_worker where id='local-native' and generation_available and heartbeat_at>now()-interval '45 seconds') then raise exception 'Native image worker is offline. Start the QA image worker first.'; end if;
  select * into a from public.ads where product_id=p_product_id and id=p_ad_id for update;
  if not found or a.deleted_at is not null or coalesce((a.meta->>'_productBoundaryQuarantined')::boolean,false) then raise exception 'Creative is unavailable'; end if;
  if exists(select 1 from public.deleted_ads where product_id=p_product_id and id=p_ad_id) then raise exception 'Creative was deleted'; end if;
  if jsonb_typeof(p_options) is distinct from 'object' or octet_length(p_options::text)>24000 then raise exception 'Invalid generation options'; end if;
  if jsonb_typeof(p_options->'count') is distinct from 'number' or coalesce(p_options->>'count','') !~ '^(10|[1-9])$' then raise exception 'Choose 1 to 10 images'; end if;
  n:=(p_options->>'count')::integer;
  foreach k in array array['instruction','referenceUrl','offer','market','productName','forbiddenAliases'] loop
    if jsonb_typeof(p_options->k) is distinct from 'string' or length(p_options->>k)>6000 then raise exception 'Invalid generation field: %',k; end if;
  end loop;
  if nullif(trim(p_options->>'productName'),'') is null then raise exception 'Canonical product name is required'; end if;
  if coalesce(p_options->>'referenceUrl','')<>'' and p_options->>'referenceUrl' !~ '^https://' then raise exception 'Reference must be an HTTPS image URL'; end if;
  if jsonb_typeof(p_options->'referenceIds') is distinct from 'array' or jsonb_array_length(p_options->'referenceIds')>10 then raise exception 'Invalid format references'; end if;
  if exists(select 1 from jsonb_array_elements_text(p_options->'referenceIds') r where not exists(select 1 from public.ads where id=r and product_id=p_product_id and deleted_at is null and not coalesce((meta->>'_productBoundaryQuarantined')::boolean,false))) then raise exception 'Reference is outside this product'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into refs from public.ads x where x.product_id=p_product_id and x.id in(select jsonb_array_elements_text(p_options->'referenceIds'));
  defaults:=jsonb_build_object('offer',p_options->>'offer','market',p_options->>'market','product_name',p_options->>'productName','forbidden_aliases',p_options->>'forbiddenAliases');
  update public.products set config=jsonb_set(coalesce(config,'{}'),'{production}',coalesce(config->'production','{}')||defaults,true) where id=p_product_id;
  insert into public.qa_image_runs(id,product_id,ad_id,requested_by,request)
    values(p_request_id,p_product_id,p_ad_id,auth.uid(),jsonb_build_object('options',p_options,'creative',to_jsonb(a),'references',refs,
      'memory',coalesce((select json from public.strategist_memory where product_id=p_product_id limit 1),'{}'::jsonb))) returning * into result;
  return result;
end $$;
revoke all on function public.qa_generate_images(uuid,text,text,jsonb) from public,anon;
grant execute on function public.qa_generate_images(uuid,text,text,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('qa-producer-images','qa-producer-images',false,20971520,array['image/png']) on conflict(id) do nothing;
drop policy if exists qa_generated_image_read on storage.objects;
create policy qa_generated_image_read on storage.objects for select to authenticated
 using(bucket_id='qa-producer-images' and exists(select 1 from public.qa_image_runs r where r.id::text=(storage.foldername(name))[1] and public.has_product(r.product_id)));
