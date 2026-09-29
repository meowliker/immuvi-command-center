-- One-time, user-requested cleanup. Execute only through the pinned QA project.
-- Never apply as a migration or run against the legacy/production project.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $$
declare
  pid constant text := 'qa-sample-astrorekha';
  seed_ids text[];
  a_id text;
  snapshot jsonb;
begin
  perform 1 from public.products where id=pid and name='AstroRekha - QA Sample' for update;
  if not found then raise exception 'Expected QA sample product not found'; end if;
  lock table public.ads, public.manual_actions, public.matrix_cells, public.qa_image_runs,
    public.producer_runs, public.qa_clickup_creations, public.inspiration_queue,
    public.strategist_runs, public.competitor_research_queue in share row exclusive mode;
  if exists(select 1 from public.admin_audit_log where action='qa_seed_tasks_removed_20260928' and target_product=pid)
    then raise exception 'Cleanup already recorded; refusing to repeat'; end if;
  if (public.qa_product_manifest(pid)->>'blocked')::boolean
    or exists(select 1 from public.qa_image_runs where product_id=pid and status in ('pending','running'))
    then raise exception 'Resolve active work before cleanup'; end if;
  select array_agg(id order by id) into seed_ids from public.ads
    where product_id=pid and deleted_at is null and id like 'qa-sample-%' and meta->>'qaSample'='true'
      and coalesce(clickup_task_id,'')='' and coalesce(meta->>'_clickupId','')=''
      and coalesce(meta->>'clickupTaskId','')='';
  if coalesce(cardinality(seed_ids),0)<>27 then raise exception 'Expected exactly 27 unlinked seed creatives'; end if;
  if (select count(*) from public.manual_actions where product_id=pid and payload->>'qaSample'='true'
      and coalesce(payload->>'_clickupId','')='' and coalesce(payload->>'clickupTaskId','')='')<>5
    then raise exception 'Expected exactly 5 unlinked seed actions'; end if;

  select jsonb_build_object(
    'source','operator-cli: explicit user request',
    'projectRef','entgcnlfsnysnwyadzzp',
    'beforeAds',(select jsonb_agg(to_jsonb(a)) from public.ads a where product_id=pid and id=any(seed_ids)),
    'beforeActions',(select jsonb_agg(to_jsonb(m)) from public.manual_actions m where product_id=pid and payload->>'qaSample'='true'
      and coalesce(payload->>'_clickupId','')='' and coalesce(payload->>'clickupTaskId','')=''),
    'beforeCells',(select jsonb_agg(to_jsonb(c)) from public.matrix_cells c where product_id=pid),
    'removedCreatives',27,'removedActions',5,'remoteTasksChanged',0
  ) into snapshot;
  insert into public.admin_audit_log(actor_id,action,target_product,meta)
    values(null,'qa_seed_tasks_removed_20260928',pid,snapshot);
  insert into public.deleted_ads(id,product_id,clickup_task_id,format_name,deleted_by,reason)
    select id,pid,null,format_name,'operator-cli','qa-seed-cleanup' from public.ads where product_id=pid and id=any(seed_ids)
    on conflict(id) do nothing;
  update public.ads set deleted_at=now() where product_id=pid and id=any(seed_ids);
  delete from public.manual_actions where product_id=pid and payload->>'qaSample'='true'
    and coalesce(payload->>'_clickupId','')='' and coalesce(payload->>'clickupTaskId','')='';
  foreach a_id in array seed_ids loop
    update public.matrix_cells set creative_assignments=creative_assignments-a_id,
      meta=coalesce((select jsonb_object_agg(key,value) from jsonb_each(meta)
        where key<>a_id and left(key,length(a_id)+2)<>a_id||'||'),'{}')
      where product_id=pid and (creative_assignments ? a_id or meta ? a_id or exists(
        select 1 from jsonb_object_keys(meta) k where left(k,length(a_id)+2)=a_id||'||'));
  end loop;
end $$;
commit;
select jsonb_build_object(
  'activeCreatives',(select count(*) from public.ads where product_id='qa-sample-astrorekha' and deleted_at is null),
  'actions',(select count(*) from public.manual_actions where product_id='qa-sample-astrorekha'),
  'angles',(select count(*) from public.angles where product_id='qa-sample-astrorekha'),
  'personas',(select count(*) from public.personas where product_id='qa-sample-astrorekha'),
  'inspirations',(select count(*) from public.inspirations where product_id='qa-sample-astrorekha'),
  'imageRuns',(select count(*) from public.qa_image_runs where product_id='qa-sample-astrorekha'),
  'auditId',(select id from public.admin_audit_log where action='qa_seed_tasks_removed_20260928' and target_product='qa-sample-astrorekha')
) as cleanup_receipt;
