-- Only the server may record names returned by ClickUp's authenticated-user API.
create table public.qa_clickup_identities (
  user_id uuid not null references auth.users(id) on delete cascade,
  clickup_user_id text not null check (length(clickup_user_id) between 1 and 200),
  name text not null check (length(trim(name)) between 1 and 200),
  primary key (user_id,clickup_user_id)
);
alter table public.qa_clickup_identities enable row level security;
revoke all on public.qa_clickup_identities from public,anon,authenticated;
grant select,insert,update,delete on public.qa_clickup_identities to service_role;
alter table public.qa_user_presence add column clickup_user_id text;

create function public.qa_presence(p_session_id uuid, p_leave boolean, p_clickup_user_id text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare members jsonb; verified_id text;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and is_active and not must_change_password) then
    raise exception 'Active account required';
  end if;
  if p_session_id is null then raise exception 'Session ID required'; end if;
  if p_leave then
    delete from public.qa_user_presence where session_id=p_session_id and user_id=auth.uid();
    return '[]'::jsonb;
  end if;
  select clickup_user_id into verified_id from public.qa_clickup_identities
    where user_id=auth.uid() and clickup_user_id=p_clickup_user_id;
  insert into public.qa_user_presence(session_id,user_id,clickup_user_id) values(p_session_id,auth.uid(),verified_id)
    on conflict(session_id) do update set seen_at=clock_timestamp(),clickup_user_id=excluded.clickup_user_id
    where qa_user_presence.user_id=auth.uid();
  if not found then raise exception 'Session identity conflict'; end if;
  delete from public.qa_user_presence where seen_at<clock_timestamp()-interval '90 seconds';
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',coalesce(n.name,nullif(p.username,''),nullif(p.full_name,''),'Teammate')) order by p.id),'[]'::jsonb)
    into members from public.profiles p
    left join lateral (
      select i.name from public.qa_user_presence s
      join public.qa_clickup_identities i on i.user_id=s.user_id and i.clickup_user_id=s.clickup_user_id
      where s.user_id=p.id and s.seen_at>=clock_timestamp()-interval '90 seconds'
      order by s.seen_at desc,s.session_id limit 1
    ) n on true
    where p.is_active and not p.must_change_password
      and exists(select 1 from public.qa_user_presence s where s.user_id=p.id and s.seen_at>=clock_timestamp()-interval '90 seconds');
  return members;
end $$;
revoke all on function public.qa_presence(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.qa_presence(uuid,boolean,text) to authenticated;

-- Older open tabs can keep heartbeating until they refresh.
create or replace function public.qa_presence(p_session_id uuid, p_leave boolean default false) returns jsonb
language sql security invoker set search_path=public as $$
  select public.qa_presence(p_session_id,p_leave,null);
$$;
