-- Each QA product uses a separately provisioned, test-list-scoped library.
-- Never inherit the legacy production config.doc_id or production folder.
do $$ declare body text; marker text; begin
 select pg_get_functiondef('public.qa_private_inspiration_enqueue(uuid,text,text,uuid,text)'::regprocedure) into body;
 marker:='''docVisibility'',coalesce(p.config->>''qa_brief_visibility'',''PRIVATE'')';
 if position(marker in body)=0 then raise exception 'Enqueue contract changed'; end if;
 execute replace(body,marker,marker||',''libraryDocId'',p.config->>''qa_brief_doc_id'',''libraryTrackerPageId'',p.config->>''qa_brief_tracker_page_id''');

 select pg_get_functiondef('public.qa_private_inspiration_retry_delivery(uuid,text,text,uuid,text)'::regprocedure) into body;
 marker:='if j.result is null or j.delivery_started or j.doc_id is not null or j.page_id is not null then';
 if position(marker in body)=0 then raise exception 'Retry guard contract changed'; end if;
 body:=replace(body,marker,'if j.result is null or ((j.delivery_started or j.doc_id is not null or j.page_id is not null) and not (coalesce(j.context->>''libraryDocId'','''')<>'''' and (j.doc_id is null or j.doc_id=j.context->>''libraryDocId''))) then');
 marker:='visibility:=coalesce(p.config->>''qa_brief_visibility'',''PRIVATE'');';
 body:=replace(body,marker,E'if j.context->>''libraryDocId'' is not null and (j.context->>''libraryDocId'' is distinct from p.config->>''qa_brief_doc_id'' or j.context->>''libraryTrackerPageId'' is distinct from p.config->>''qa_brief_tracker_page_id'') then raise exception ''Library destination changed; review saved receipts''; end if;\n '||marker);
 marker:='context=jsonb_set(context,''{docVisibility}'',to_jsonb(visibility))';
 if position(marker in body)=0 then raise exception 'Retry context contract changed'; end if;
 body:=replace(body,marker,'context=context||jsonb_build_object(''docVisibility'',visibility,''libraryDocId'',p.config->>''qa_brief_doc_id'',''libraryTrackerPageId'',p.config->>''qa_brief_tracker_page_id'')');
 execute body;

 select pg_get_functiondef('public.qa_private_inspiration_delivery_rejected(uuid,uuid,integer,text)'::regprocedure) into body;
 marker:='or j.doc_id is not null or j.page_id is not null';
 if position(marker in body)=0 then raise exception 'Rejection contract changed'; end if;
 body:=replace(body,marker,'or (j.doc_id is not null and j.doc_id is distinct from j.context->>''libraryDocId'') or j.page_id is not null');
 body:=replace(body,'''stage'',''create Doc''','''stage'',case when j.doc_id is not null then ''create brief page'' else ''create Doc'' end');
 execute body;

 select pg_get_functiondef('public.qa_private_inspiration_status(text)'::regprocedure) into body;
 marker:='status=''failed'' and result is not null and not delivery_started and doc_id is null and page_id is null';
 if position(marker in body)=0 then raise exception 'Status contract changed'; end if;
 execute replace(body,marker,'status=''failed'' and result is not null and ((not delivery_started and doc_id is null and page_id is null) or (coalesce(context->>''libraryDocId'','''')<>'''' and (doc_id is null or doc_id=context->>''libraryDocId'')))');
end $$;

create function public.qa_private_inspiration_tracker_rows(p_id uuid,p_lease uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers:=public.qa_private_worker_identity();j public.qa_private_inspiration_jobs;rows jsonb;begin
 select * into j from public.qa_private_inspiration_jobs where id=p_id and worker_id=w.id and requested_by=w.owner_id and lease_id=p_lease;
 if not found then raise exception 'Worker job access denied' using errcode='42501'; end if;
 if j.status<>'running' or j.lease_until<=now() or j.doc_id is null or j.page_id is null then raise exception 'Verified page receipt required'; end if;
 if not exists(select 1 from public.products where id=j.product_id and config->>'clickup_list_id'='1301130000002447' and config->>'qa_brief_doc_id'=j.doc_id)
 or j.doc_id is distinct from j.context->>'libraryDocId' then raise exception 'Library destination changed'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'brand',i.data->>'brand','platform',i.platform,'angle',i.data->>'angle','persona',i.data->>'persona','hook',i.data->>'hookType','funnel',i.data->>'funnelStage','status',i.status,'url',i.data->>'_clickupDocPageUrl') order by i.id),'[]') into rows
 from public.inspirations i where i.product_id=j.product_id and i.id<>j.inspiration_id and i.data->>'_clickupDocPageUrl' like 'https://app.clickup.com/9016762494/docs/'||j.doc_id||'/%';
 return rows||jsonb_build_array(jsonb_build_object('id',j.inspiration_id,'brand',j.result->'metadata'->>'page_name','platform',j.context->>'platform','angle',j.result->'classification'->>'angle','persona',j.result->'classification'->>'persona','hook',j.result->'classification'->>'hook_type','funnel',j.result->'classification'->>'funnel_type','status','Brief saved','url','https://app.clickup.com/9016762494/docs/'||j.doc_id||'/'||j.page_id));
end $$;
revoke all on function public.qa_private_inspiration_tracker_rows(uuid,uuid) from public;
grant execute on function public.qa_private_inspiration_tracker_rows(uuid,uuid) to anon,authenticated;

-- Publication must still target the configured library, even if it was changed
-- while this job was delivering. Completed jobs clear the old failure message.
do $$ declare body text; marker text:='elsif p_stage=''complete'' then'; begin
 select pg_get_functiondef('public.qa_private_inspiration_checkpoint(uuid,uuid,text,jsonb)'::regprocedure) into body;
 if position(marker in body)=0 then raise exception 'Publication contract changed'; end if;
 body:=replace(body,marker,marker||E'\n   if j.context->>''libraryDocId'' is not null and not exists(select 1 from public.products where id=j.product_id and config->>''qa_brief_doc_id''=j.context->>''libraryDocId'' and config->>''qa_brief_tracker_page_id''=j.context->>''libraryTrackerPageId'') then raise exception ''Library destination changed''; end if;');
 body:=replace(body,'set status=''done'',finished_at=now(),sealed_clickup_token=''''','set status=''done'',error=null,finished_at=now(),sealed_clickup_token=''''');
 execute body;
end $$;
