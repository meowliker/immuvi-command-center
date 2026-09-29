-- IDs are global, so allocation and identity checks must also be global.
create table if not exists public.inspiration_identity (
  id text primary key,
  product_id text not null references public.products(id),
  source_url text not null default '',
  request_id uuid unique,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.inspiration_id_counters (
  prefix text primary key,
  last_number bigint not null default 0
);
create table if not exists public.inspiration_history (
  revision_id bigint generated always as identity primary key,
  inspiration_id text not null,
  operation text not null,
  old_row jsonb,
  new_row jsonb,
  changed_at timestamptz not null default now()
);
alter table public.inspiration_identity enable row level security;
alter table public.inspiration_id_counters enable row level security;
alter table public.inspiration_history enable row level security;
revoke all on public.inspiration_identity, public.inspiration_id_counters, public.inspiration_history from anon, authenticated;

insert into public.inspiration_identity(id,product_id,source_url)
select id,product_id,coalesce(url,'') from public.inspirations on conflict do nothing;

create or replace function public.guard_inspiration_identity() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare identity_row public.inspiration_identity;
begin
  if tg_op='UPDATE' and (new.id is distinct from old.id or new.product_id is distinct from old.product_id
    or (coalesce(old.url,'')<>'' and new.url is distinct from old.url)) then
    raise exception 'Inspiration identity conflict; reload before saving' using errcode='23514';
  end if;
  select * into identity_row from inspiration_identity where id=new.id;
  if tg_op='INSERT' and identity_row.deleted_at is not null then
    raise exception 'Deleted inspiration IDs cannot be reused' using errcode='23514';
  end if;
  if found and (identity_row.product_id<>new.product_id or
    (identity_row.source_url<>'' and identity_row.source_url<>coalesce(new.url,''))) then
    raise exception 'Inspiration ID already belongs to another source or product' using errcode='23514';
  end if;
  if tg_op='INSERT' and identity_row.id is null and auth.role()='authenticated' then
    raise exception 'Reload the app to use server-assigned inspiration IDs' using errcode='23514';
  end if;
  if tg_op='UPDATE' and auth.role()='authenticated' and
    (new.data->>'_baseUpdatedAt') is distinct from old.updated_at::text and
    coalesce((new.data->>'_baseUpdatedAt')::timestamptz,'epoch')<>old.updated_at then
    raise exception 'Inspiration changed on the server; reload before saving' using errcode='40001';
  end if;
  if new.data ? 'product_id' and new.data->>'product_id'<>new.product_id then
    raise exception 'Inspiration metadata product mismatch' using errcode='23514';
  end if;
  if coalesce(new.data->>'sourceUrl','')<>'' and new.data->>'sourceUrl'<>coalesce(new.url,'') then
    raise exception 'Inspiration metadata source mismatch' using errcode='23514';
  end if;
  -- UPSERT executes INSERT triggers before UPDATE triggers; keep its revision
  -- marker until the UPDATE check has run.
  if tg_op='UPDATE' then new.data := new.data - '_baseUpdatedAt' - '_persistedSignature'; end if;
  insert into inspiration_identity(id,product_id,source_url) values(new.id,new.product_id,coalesce(new.url,''))
    on conflict(id) do update set source_url=case when inspiration_identity.source_url='' then excluded.source_url else inspiration_identity.source_url end;
  return new;
end $$;
drop trigger if exists guard_inspiration_identity on public.inspirations;
create trigger guard_inspiration_identity before insert or update on public.inspirations
for each row execute function public.guard_inspiration_identity();

create or replace function public.record_inspiration_history() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' then update inspiration_identity set deleted_at=now() where id=old.id; end if;
  insert into inspiration_history(inspiration_id,operation,old_row,new_row)
  values(coalesce(new.id,old.id),tg_op,case when tg_op<>'INSERT' then to_jsonb(old) end,
    case when tg_op<>'DELETE' then to_jsonb(new) end);
  return coalesce(new,old);
end $$;
drop trigger if exists record_inspiration_history on public.inspirations;
create trigger record_inspiration_history after insert or update or delete on public.inspirations
for each row execute function public.record_inspiration_history();

create or replace function public.create_inspiration(p_product_id text,p_request_id uuid,p_data jsonb)
returns public.inspirations language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.products; v_prefix text; n bigint; new_id text; result public.inspirations; prior public.inspiration_identity;
begin
  if auth.uid() is null or not public.has_product(p_product_id) then
    raise exception 'Product access denied' using errcode='42501';
  end if;
  if p_request_id is null or jsonb_typeof(p_data)<>'object' then raise exception 'Invalid inspiration request'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into prior from inspiration_identity where request_id=p_request_id;
  if found then
    if prior.product_id<>p_product_id or prior.source_url<>coalesce(p_data->>'sourceUrl','') then
      raise exception 'Request identity conflict';
    end if;
    select * into result from inspirations where id=prior.id and product_id=p_product_id;
    if not found then raise exception 'Inspiration was deleted; create a new request'; end if;
    return result;
  end if;
  select * into strict p from products where id=p_product_id;
  v_prefix := nullif(trim(p.config->>'ins_prefix'),'');
  if v_prefix is null then
    select left(string_agg(left(word,1),'' order by ordinality),3) into v_prefix
      from regexp_split_to_table(trim(p.name),'\s+') with ordinality as words(word,ordinality)
      where word<>'';
  end if;
  v_prefix := upper(regexp_replace(coalesce(v_prefix,'INS'),'[^a-zA-Z0-9]','','g'));
  if v_prefix='' then v_prefix:='INS'; end if;
  insert into inspiration_id_counters values(v_prefix,0) on conflict do nothing;
  select last_number into n from inspiration_id_counters where inspiration_id_counters.prefix=v_prefix for update;
  select greatest(n,coalesce(max(substring(ids.id from '([0-9]+)$')::bigint),0)) into n from (
    select id from inspiration_identity union all select ins_id from inspiration_queue
    union all select ins_id from inspiration_results
  ) ids where ids.id ~ ('^'||v_prefix||'-INS-[0-9]+$');
  n:=n+1; new_id:=v_prefix||'-INS-'||lpad(n::text,greatest(3,length(n::text)),'0');
  update inspiration_id_counters set last_number=n where inspiration_id_counters.prefix=v_prefix;
  insert into inspiration_identity(id,product_id,source_url,request_id)
    values(new_id,p_product_id,coalesce(p_data->>'sourceUrl',''),p_request_id);
  p_data:=(p_data-'_baseUpdatedAt'-'_persistedSignature')||jsonb_build_object('id',new_id,'product_id',p_product_id);
  insert into inspirations(id,product_id,url,title,platform,added_by,status,data)
    values(new_id,p_product_id,coalesce(p_data->>'sourceUrl',''),coalesce(p_data->>'title',p_data->>'formatName'),
      p_data->>'platform',p_data->>'addedBy',coalesce(p_data->>'status','Saved'),p_data) returning * into result;
  return result;
end $$;
revoke all on function public.create_inspiration(text,uuid,jsonb) from public,anon;
grant execute on function public.create_inspiration(text,uuid,jsonb) to authenticated;

create or replace function public.guard_inspiration_job_source() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from inspirations where id=new.ins_id and product_id=new.product_id
    and url=coalesce(to_jsonb(new)->>'url',to_jsonb(new)->>'source_url')) then
    raise exception 'Inspiration job source does not match its saved inspiration' using errcode='23514';
  end if;
  return new;
end $$;
drop trigger if exists guard_inspiration_job_source on public.inspiration_queue;
create trigger guard_inspiration_job_source before insert or update of ins_id,product_id,url on public.inspiration_queue
for each row execute function public.guard_inspiration_job_source();
drop trigger if exists guard_inspiration_result_source on public.inspiration_results;
create trigger guard_inspiration_result_source before insert or update of ins_id,product_id,source_url on public.inspiration_results
for each row execute function public.guard_inspiration_job_source();
