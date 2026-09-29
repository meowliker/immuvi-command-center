-- QA-only. Replace permissive legacy policies, not existing application records.
do $$
declare t text; policy record; predicate text;
begin
  foreach t in array array[
    'products','ads','manual_actions','angles','personas','angle_personas','matrix_cells',
    'inspirations','inspiration_queue','inspiration_results','deleted_ads','activity_events',
    'producer_runs','strategist_memory','strategist_processed','strategist_runs',
    'competitor_brands','competitor_creatives','competitor_research_queue','strategist_recommendations',
    'task_video_winners','task_drive_cache','variation_briefs','variation_brief_queue'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    for policy in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I',policy.policyname,t);
    end loop;
    execute format('revoke all on table public.%I from public,anon',t);
    -- TRUNCATE bypasses RLS; clients only need row-level DML.
    execute format('revoke all on table public.%I from authenticated',t);
    execute format('grant select,insert,update,delete on table public.%I to authenticated',t);
    if t='products' then
      execute 'create policy qa_product_read on public.products for select to authenticated using(public.has_product(id))';
      execute 'create policy qa_product_admin on public.products for all to authenticated using(public.is_admin()) with check(public.is_admin())';
    else
      if t in ('task_video_winners','task_drive_cache','variation_briefs') then
        predicate:=format('exists(select 1 from public.ads a where a.id=%I.ad_id and public.has_product(a.product_id))',t);
      elsif t='variation_brief_queue' then
        predicate:='exists(select 1 from public.ads parent join public.ads target on target.product_id=parent.product_id
          where parent.id=variation_brief_queue.parent_ad_id and target.id=variation_brief_queue.target_ad_id
          and public.has_product(parent.product_id))';
      else
        predicate:='public.has_product(product_id)';
      end if;
      execute format('create policy qa_product_access on public.%I for all to authenticated using(%s) with check(%s)',t,predicate,predicate);
    end if;
  end loop;
end $$;

-- Members must not need blanket product UPDATE access to acquire the workflow
-- lock or advance the naming/sync metadata. These existing functions validate
-- auth.uid(), active/password-cleared product access, and product-scoped inputs.
alter function public.qa_tracker_access(text) security definer;
alter function public.qa_tracker_access(text) set search_path=public,pg_temp;
alter function public.qa_matrix_create(text,text,text,text,jsonb,uuid) security definer;
alter function public.qa_matrix_create(text,text,text,text,jsonb,uuid) set search_path=public,pg_temp;
alter function public.apply_qa_clickup_sync(text,text,timestamptz,jsonb) security definer;
alter function public.apply_qa_clickup_sync(text,text,timestamptz,jsonb) set search_path=public,pg_temp;
revoke all on function public.qa_tracker_access(text),public.qa_matrix_create(text,text,text,text,jsonb,uuid),
  public.apply_qa_clickup_sync(text,text,timestamptz,jsonb) from public,anon;
grant execute on function public.qa_tracker_access(text),public.qa_matrix_create(text,text,text,text,jsonb,uuid),
  public.apply_qa_clickup_sync(text,text,timestamptz,jsonb) to authenticated;
