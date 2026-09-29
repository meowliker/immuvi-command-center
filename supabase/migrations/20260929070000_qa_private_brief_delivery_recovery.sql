alter table public.qa_private_inspiration_jobs add column delivery_rejection jsonb;

-- Only a definitive rejected create request can reopen the non-idempotent
-- boundary. Timeouts, 5xx responses and saved Doc/page receipts stay closed.
create function public.qa_private_inspiration_delivery_rejected(p_id uuid,p_lease uuid,p_status integer,p_code text default '') returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers:=public.qa_private_worker_identity(); j public.qa_private_inspiration_jobs;
begin
 select * into j from public.qa_private_inspiration_jobs where id=p_id and worker_id=w.id and requested_by=w.owner_id and lease_id=p_lease for update;
 if not found then raise exception 'Worker job access denied' using errcode='42501'; end if;
 if j.status<>'running' or j.lease_until<=now() then raise exception 'Job lease expired'; end if;
 if p_status is null or p_status not in (400,401,403,404,422,429) or not j.delivery_started or j.doc_id is not null or j.page_id is not null or j.result is null then
   raise exception 'Delivery receipt requires review';
 end if;
 update public.qa_private_inspiration_jobs set delivery_started=false,
 delivery_rejection=jsonb_build_object('stage','create Doc','status',p_status,'code',case when p_code ~ '^[A-Z][A-Z0-9_]{1,39}$' then p_code else '' end,'at',now()) where id=j.id;
end $$;
revoke all on function public.qa_private_inspiration_delivery_rejected(uuid,uuid,integer,text) from public;
grant execute on function public.qa_private_inspiration_delivery_rejected(uuid,uuid,integer,text) to anon,authenticated;

create function public.qa_private_inspiration_retry_delivery(p_id uuid,p_product_id text,p_inspiration_id text,p_worker_id uuid,p_sealed_token text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers; j public.qa_private_inspiration_jobs; i public.inspirations; p public.products; visibility text;
begin
 perform public.qa_tracker_access(p_product_id);
 select * into j from public.qa_private_inspiration_jobs where id=p_id and requested_by=auth.uid() and product_id=p_product_id and inspiration_id=p_inspiration_id and worker_id=p_worker_id for update;
 if not found then raise exception 'Private job access denied' using errcode='42501'; end if;
 if j.status in ('pending','running','done') then return jsonb_build_object('id',j.id,'status',j.status,'inspirationId',j.inspiration_id); end if;
 if j.result is null or j.delivery_started or j.doc_id is not null or j.page_id is not null then raise exception 'Delivery receipt requires review'; end if;
 select * into w from public.qa_private_workers where id=j.worker_id and owner_id=auth.uid() and enabled and classifier_available and heartbeat_at>now()-interval '45 seconds' and delivery_public_key is not null;
 if not found then raise exception 'Your private classifier is offline or unavailable'; end if;
 if p_sealed_token is null or length(p_sealed_token)<>512 or p_sealed_token !~ '^[A-Za-z0-9+/=]+$' then raise exception 'Invalid sealed delivery credential'; end if;
 select * into p from public.products where id=j.product_id for share;
 if coalesce(p.config->>'clickup_list_id','')<>'1301130000002447' or j.context->>'listId' is distinct from '1301130000002447' then raise exception 'Only the approved ClickUp test list is allowed'; end if;
 visibility:=coalesce(p.config->>'qa_brief_visibility','PRIVATE');
 if visibility not in ('PRIVATE','PUBLIC') then raise exception 'Invalid brief visibility'; end if;
 select * into i from public.inspirations where id=j.inspiration_id and product_id=j.product_id for update;
 if not found or i.data->>'_qaCreatedBy' is distinct from auth.uid()::text or i.url is distinct from j.source_url or i.updated_at is distinct from j.source_version then raise exception 'Inspiration changed; review the saved brief before delivery'; end if;
 if i.data->>'_clickupDocPageUrl' is not null or exists(select 1 from public.inspiration_results where product_id=j.product_id and ins_id=j.inspiration_id) then raise exception 'This inspiration already has a published result'; end if;
 update public.qa_private_inspiration_jobs set status='pending',sealed_clickup_token=p_sealed_token,error=null,finished_at=null,lease_id=null,lease_until=null,
 context=jsonb_set(context,'{docVisibility}',to_jsonb(visibility)) where id=j.id;
 update public.inspiration_queue set status='blocked',worker_assignment='private:'||w.id,error_message='Saved brief queued for delivery',queued_at=now() where product_id=j.product_id and ins_id=j.inspiration_id;
 return jsonb_build_object('id',j.id,'status','pending','inspirationId',j.inspiration_id);
end $$;
revoke all on function public.qa_private_inspiration_retry_delivery(uuid,text,text,uuid,text) from public,anon;
grant execute on function public.qa_private_inspiration_retry_delivery(uuid,text,text,uuid,text) to authenticated;

create or replace function public.qa_private_inspiration_status(p_product_id text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.qa_tracker_access(p_product_id);
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'inspiration_id',inspiration_id,'status',status,'error',error,'created_at',created_at,'finished_at',finished_at,'doc_id',doc_id,'page_id',page_id,
 'has_result',result is not null,'can_retry_delivery',status='failed' and result is not null and not delivery_started and doc_id is null and page_id is null) order by created_at desc)
 from public.qa_private_inspiration_jobs where product_id=p_product_id and requested_by=auth.uid()),'[]');
end $$;

-- Enqueue snapshots the product's explicitly configured sharing policy.
do $$ declare body text; marker text:='''platform'',i.platform,''listId'',''1301130000002447'''; begin
 select pg_get_functiondef('public.qa_private_inspiration_enqueue(uuid,text,text,uuid,text)'::regprocedure) into body;
 if position(marker in body)=0 then raise exception 'Enqueue contract changed'; end if;
 execute replace(body,marker,marker||',''docVisibility'',coalesce(p.config->>''qa_brief_visibility'',''PRIVATE'')');
end $$;

-- The old client discarded error bodies, but its exact 403 plus the absence of
-- a Doc receipt identifies a rejected create request (not a network timeout).
update public.qa_private_inspiration_jobs set delivery_started=false,
 delivery_rejection=jsonb_build_object('stage','create Doc','status',403,'at',finished_at,'source','legacy HTTP status'),
 error='ClickUp refused to create the brief Doc (403). The generated brief is saved; check Docs permissions and visibility, then retry delivery.'
where status='failed' and delivery_started and result is not null and doc_id is null and page_id is null
 and context->>'listId'='1301130000002447'
 and error='ClickUp brief delivery failed (403); review saved receipts before retrying.';
