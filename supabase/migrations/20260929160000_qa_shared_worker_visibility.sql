-- Shared activity is visible to authorized product users. Mutations stay requester-only.
create or replace function public.qa_inspiration_workers_list(p_product_id text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.qa_tracker_access(p_product_id);
 return coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'scope',w.scope,
 'enabled',w.enabled,'heartbeat_at',w.heartbeat_at,'classifier_available',w.enabled and w.classifier_available,
 'generation_available',w.scope='private' and w.enabled and w.generation_available,
 'codex_active',w.codex_active,'claude_active',w.claude_active,'delivery_public_key',w.delivery_public_key,
 'can_manage',w.owner_id=auth.uid()) order by w.created_at)
 from public.qa_private_workers w where public.qa_worker_job_access(w,auth.uid(),p_product_id)),'[]');
end $$;

create or replace function public.qa_private_inspiration_status(p_product_id text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.qa_tracker_access(p_product_id);
 return coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'inspiration_id',j.inspiration_id,'status',j.status,
 'error',j.error,'created_at',j.created_at,'finished_at',j.finished_at,'doc_id',j.doc_id,'page_id',j.page_id,
 'worker_id',j.worker_id,'worker_name',w.name,'scope',w.scope,'priority',j.priority,'can_control',j.requested_by=auth.uid(),
 'has_result',j.result is not null,'can_retry_delivery',j.requested_by=auth.uid() and j.status='failed' and j.result is not null
 and ((not j.delivery_started and j.doc_id is null and j.page_id is null) or
 (coalesce(j.context->>'libraryDocId','')<>'' and (j.doc_id is null or j.doc_id=j.context->>'libraryDocId')))) order by j.created_at desc)
 from public.qa_private_inspiration_jobs j join public.qa_private_workers w on w.id=j.worker_id
 where j.product_id=p_product_id and (j.requested_by=auth.uid() or (w.scope='shared' and w.product_id=p_product_id))),'[]');
end $$;

-- A local owner can pause/resume only their credential's shared device.
create function public.qa_shared_worker_set_paused(p_paused boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers:=public.qa_private_worker_identity();
begin
 if w.scope<>'shared' or p_paused is null then raise exception 'Shared device required' using errcode='42501';end if;
 update public.qa_private_workers set enabled=not p_paused where id=w.id;
end $$;
revoke all on function public.qa_shared_worker_set_paused(boolean) from public;
grant execute on function public.qa_shared_worker_set_paused(boolean) to anon,authenticated;
