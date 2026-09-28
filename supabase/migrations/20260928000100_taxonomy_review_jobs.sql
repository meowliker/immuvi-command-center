-- Additive queue only. Never update inspirations, creatives, taxonomy or briefs.
create table if not exists public.taxonomy_review_jobs (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id),
  ins_id text not null references public.inspirations(id),
  requested_by uuid not null references auth.users(id),
  requested_signature text not null check (length(requested_signature) <= 100),
  worker_assignment text not null default 'gp-mac-mini' check (worker_assignment = 'gp-mac-mini'),
  status text not null default 'pending' check (status in ('pending','running','complete','failed')),
  attempts integer not null default 0,
  claimed_by text,
  claimed_at timestamptz,
  queued_at timestamptz not null default now(),
  finished_at timestamptz,
  result jsonb,
  error_message text,
  unique(product_id, ins_id, requested_signature)
);
create index if not exists taxonomy_review_pending on public.taxonomy_review_jobs(queued_at) where status = 'pending';
alter table public.taxonomy_review_jobs enable row level security;
revoke all on public.taxonomy_review_jobs from anon, authenticated;
grant select on public.taxonomy_review_jobs to authenticated;
grant all on public.taxonomy_review_jobs to service_role;
drop policy if exists taxonomy_review_product_read on public.taxonomy_review_jobs;
create policy taxonomy_review_product_read on public.taxonomy_review_jobs for select to authenticated
  using (public.has_product(product_id));

create or replace function public.request_taxonomy_review(p_product_id text, p_ins_id text, p_signature text, p_retry boolean default false)
returns public.taxonomy_review_jobs
language plpgsql security definer set search_path = public as $$
declare job public.taxonomy_review_jobs;
begin
  if auth.uid() is null or not public.has_product(p_product_id) then
    raise exception 'Product access denied' using errcode = '42501';
  end if;
  if p_signature !~ '^semantic-taxonomy-v1:[a-f0-9]{64}$' then
    raise exception 'Invalid review signature';
  end if;
  if not exists(select 1 from public.inspirations where id=p_ins_id and product_id=p_product_id) then
    raise exception 'Inspiration does not belong to this product';
  end if;
  -- Bound runaway clients; duplicate requests share the existing job.
  select * into job from public.taxonomy_review_jobs
    where product_id=p_product_id and ins_id=p_ins_id and requested_signature=p_signature for update;
  if found then
    if p_retry and job.status='failed' then
      update public.taxonomy_review_jobs set status='pending', error_message=null, claimed_by=null,
        claimed_at=null, finished_at=null, queued_at=now(), attempts=0 where id=job.id returning * into job;
    end if;
    return job;
  end if;
  if (select count(*) from public.taxonomy_review_jobs where requested_by=auth.uid() and status in ('pending','running')) >= 200 then
    raise exception 'Review queue is full. Wait for current reviews to finish.';
  end if;
  insert into public.taxonomy_review_jobs(product_id,ins_id,requested_by,requested_signature)
    values(p_product_id,p_ins_id,auth.uid(),p_signature) on conflict do nothing returning * into job;
  if job.id is null then
    select * into job from public.taxonomy_review_jobs where product_id=p_product_id and ins_id=p_ins_id and requested_signature=p_signature;
  end if;
  return job;
end;
$$;
revoke all on function public.request_taxonomy_review(text,text,text,boolean) from public, anon;
grant execute on function public.request_taxonomy_review(text,text,text,boolean) to authenticated;
