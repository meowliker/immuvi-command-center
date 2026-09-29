-- Reuse the synthetic, rolled-back Matrix fixture from matrix-mutations.sql.
reset role;
insert into public.inspirations(id,product_id,url,title,status,data) values('qa-place-blocked','qa-matrix-smoke','https://example.test/blocked','Blocked','Blocked','{}'),
  ('qa-place-queue','qa-matrix-smoke','https://example.test/queue','Queue source','Classified','{}');
insert into public.inspiration_queue(ins_id,product_id,url,status,worker_assignment) values('qa-place-queue','qa-matrix-smoke','https://example.test/queue','blocked','blocked:qa-isolation');
set local role authenticated;
do $$
declare stamp timestamptz; items jsonb; ids jsonb; replay jsonb; req uuid:=gen_random_uuid();
begin
  select updated_at into stamp from public.inspirations where id='qa-place-blocked';
  begin
    perform public.qa_matrix_create('qa-matrix-smoke','qa-mx-a','qa-mx-p','inspiration',jsonb_build_array(jsonb_build_object('sourceId','qa-place-blocked','version',stamp)),gen_random_uuid());
    raise exception 'FAILED blocked source';
  exception when others then if sqlerrm<>'Inspiration is not ready' then raise; end if; end;
  select updated_at into stamp from public.inspirations where id='qa-place-queue';
  items:=jsonb_build_array(jsonb_build_object('sourceId','qa-place-queue','version',stamp));
  begin
    perform public.qa_matrix_create('qa-matrix-smoke','qa-mx-a','qa-mx-p','inspiration',items,gen_random_uuid());raise exception 'FAILED blocked queue';
  exception when others then if sqlerrm<>'Inspiration queue is not ready' then raise; end if; end;
  reset role;
  update public.inspiration_queue set status='classified' where ins_id='qa-place-queue';
  set local role authenticated;
  ids:=public.qa_matrix_create('qa-matrix-smoke','qa-mx-a','qa-mx-p','inspiration',items,req);
  replay:=public.qa_matrix_create('qa-matrix-smoke','qa-mx-a','qa-mx-p','inspiration',items,req);
  if replay<>ids or (select count(*) from public.ads where meta->>'_fromInspoId'='qa-place-queue')<>1 then raise exception 'Lost acknowledgement retry duplicated creative'; end if;
  select updated_at into stamp from public.inspirations where id='qa-place-queue';
  items:=jsonb_build_array(jsonb_build_object('sourceId','qa-place-queue','version',stamp));
  replay:=public.qa_matrix_create('qa-matrix-smoke','qa-mx-a','qa-mx-p','inspiration',items,gen_random_uuid());
  if replay<>ids then raise exception 'Duplicate source in cell'; end if;
  reset role;
  update public.ads set meta=meta||'{"_productBoundaryQuarantined":true}' where id=ids->>0;
  set local role authenticated;
  replay:=public.qa_matrix_create('qa-matrix-smoke','qa-mx-a','qa-mx-p','inspiration',items,gen_random_uuid());
  if replay=ids then raise exception 'Quarantined creative was restored'; end if;
  if exists(select 1 from public.manual_actions where product_id='qa-matrix-smoke') or exists(select 1 from public.ads where id=replay->>0 and clickup_task_id is not null) then raise exception 'Placement created external workflow'; end if;
  reset role;
  insert into public.deleted_ads(id,product_id) values(replay->>0,'qa-matrix-smoke');
  set local role authenticated;
  ids:=public.qa_matrix_create('qa-matrix-smoke','qa-mx-a','qa-mx-p','inspiration',items,gen_random_uuid());
  if ids=replay then raise exception 'Tombstoned creative was restored'; end if;
  reset role;
  update public.personas set archived_at=now() where id='qa-mx-p2';
  set local role authenticated;
  begin
    perform public.qa_matrix_create('qa-matrix-smoke','qa-mx-a','qa-mx-p2','inspiration',items,gen_random_uuid());raise exception 'FAILED archived destination';
  exception when others then if sqlerrm<>'Active persona is unavailable' then raise; end if; end;
end $$;
reset role;
