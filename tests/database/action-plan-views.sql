insert into auth.users(id,email,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000074','views-synthetic@example.test','{"must_change_password":false}'),
 ('00000000-0000-4000-8000-000000000075','views-other@example.test','{"must_change_password":false}');
update public.profiles set ap_col_state='{"views":[{"id":"legacy","name":"Original","columns":[]}],"legacyMarker":"preserve"}' where id='00000000-0000-4000-8000-000000000074';
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000074","role":"authenticated"}',true);
set local role authenticated;
do $$
declare value jsonb:='{"version":1,"activeViewId":"default","views":[{"id":"default","name":"Default","columns":[{"key":"cb","width":44,"hidden":false},{"key":"title","width":240,"hidden":false}]}]}'; saved jsonb;
begin
 saved:=public.qa_plan_preferences(null,value);
 if saved<>value then raise exception 'Preferences were not saved'; end if;
 if not exists(select 1 from public.profiles where id=auth.uid() and ap_col_state->>'legacyMarker'='preserve' and ap_col_state->'views'->0->>'id'='legacy') then raise exception 'Legacy preferences overwritten'; end if;
 begin
  perform public.qa_plan_preferences(null,value); raise exception 'FAILED stale preference accepted';
 exception when others then if sqlerrm not like 'Saved views changed%' then raise; end if; end;
 begin
  perform public.qa_plan_preferences(value,jsonb_set(value,'{views,0,columns,1,hidden}','true')); raise exception 'FAILED hidden task accepted';
 exception when others then if sqlerrm<>'Task and selection columns must stay visible' then raise; end if; end;
 begin
  perform public.qa_plan_preferences(value,jsonb_set(value,'{views,0,columns,1,width}','9999')); raise exception 'FAILED unbounded width accepted';
 exception when others then if sqlerrm<>'Invalid column width' then raise; end if; end;
 begin
  perform public.qa_plan_preferences(value,jsonb_set(value,'{activeViewId}','"missing"')); raise exception 'FAILED invalid active view';
 exception when others then if sqlerrm<>'Invalid active or duplicate view' then raise; end if; end;
 if (select ap_col_state->'qa_next' from public.profiles where id=auth.uid())<>value then raise exception 'Rejected save partially committed'; end if;
 saved:=public.qa_plan_preferences(value,jsonb_set(value,'{views,0,columns,1,width}','360'));
 if saved->'views'->0->'columns'->1->>'width'<>'360' then raise exception 'Width not saved'; end if;
end $$;
reset role;
do $$ begin
 if (select ap_col_state from public.profiles where id='00000000-0000-4000-8000-000000000075') is not null then raise exception 'Another user preferences changed'; end if;
end $$;
update public.profiles set is_active=false where id='00000000-0000-4000-8000-000000000074';
set local role authenticated;
do $$ begin
 begin perform public.qa_plan_preferences(null,'{}'); raise exception 'FAILED inactive user write';
 exception when others then if sqlerrm<>'Active user access is required' then raise; end if; end;
end $$;
reset role;
