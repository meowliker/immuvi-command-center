-- Presence is scoped to signed-in QA accounts, not client-supplied names or roles.
create table if not exists public.qa_user_presence (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  seen_at timestamptz not null default clock_timestamp()
);
create index if not exists qa_user_presence_seen on public.qa_user_presence(seen_at);
alter table public.qa_user_presence enable row level security;
revoke all on public.qa_user_presence from public,anon,authenticated;

create or replace function public.qa_presence(p_session_id uuid, p_leave boolean default false) returns jsonb
language plpgsql security definer set search_path=public as $$
declare members jsonb;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and is_active and not must_change_password) then
    raise exception 'Active account required';
  end if;
  if p_session_id is null then raise exception 'Session ID required'; end if;
  if p_leave then
    delete from public.qa_user_presence where session_id=p_session_id and user_id=auth.uid();
    return '[]'::jsonb;
  end if;
  insert into public.qa_user_presence(session_id,user_id) values(p_session_id,auth.uid())
    on conflict(session_id) do update set seen_at=clock_timestamp()
    where qa_user_presence.user_id=auth.uid();
  if not found then raise exception 'Session identity conflict'; end if;
  delete from public.qa_user_presence where seen_at<clock_timestamp()-interval '90 seconds';
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',coalesce(nullif(p.username,''),nullif(p.full_name,''),'Teammate')) order by p.id),'[]'::jsonb)
    into members from public.profiles p
    where p.is_active and not p.must_change_password
      and exists(select 1 from public.qa_user_presence s where s.user_id=p.id and s.seen_at>=clock_timestamp()-interval '90 seconds');
  return members;
end $$;
revoke all on function public.qa_presence(uuid,boolean) from public,anon,authenticated;
grant execute on function public.qa_presence(uuid,boolean) to authenticated;
