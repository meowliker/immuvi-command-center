-- Local PostgreSQL harness only. Auth/product primitives are minimal fixtures;
-- use --test-applied for validation against actual QA RLS/auth integration.
create role anon; create role authenticated; create role service_role;
create schema auth; create schema storage;
grant usage on schema public,auth,storage to anon,authenticated,service_role;
create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb);
create function auth.uid() returns uuid language sql as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
create function auth.role() returns text language sql as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'$$;
create table public.profiles(id uuid primary key references auth.users,role text default 'member',is_active boolean default true,must_change_password boolean default false);
create function public.fixture_profile() returns trigger language plpgsql as $$begin insert into public.profiles(id) values(new.id);return new;end$$;
create trigger fixture_profile after insert on auth.users for each row execute function public.fixture_profile();
create table public.products(id text primary key,name text,config jsonb default '{}');
create table public.user_products(user_id uuid,product_id text);
create table public.inspirations(id text primary key,product_id text,url text,platform text,status text,title text,data jsonb default '{}',updated_at timestamptz default now());
create table public.inspiration_queue(product_id text,ins_id text,status text,worker_assignment text,error_message text,queued_at timestamptz,processed_at timestamptz);
create table public.inspiration_results(ins_id text,product_id text,source_url text,platform text,metadata jsonb,classification jsonb,brief jsonb,duration_seconds numeric,frames_extracted integer,clickup_doc_page_url text,clickup_doc_id text);
create table public.angles(product_id text,name text,archived_at timestamptz);
create table public.personas(product_id text,name text,archived_at timestamptz);
create table public.qa_image_runs(id uuid,status text,requested_by uuid,product_id text,created_at timestamptz,started_at timestamptz,finished_at timestamptz,error text,request jsonb,outputs jsonb);
create table public.qa_image_worker(id text,generation_available boolean,heartbeat_at timestamptz);
create table storage.objects(bucket_id text,name text);
alter table storage.objects enable row level security;
create function public.qa_tracker_access(p_product_id text) returns void language plpgsql security definer as $$begin
 if not exists(select 1 from public.profiles p where id=auth.uid() and is_active and not must_change_password and (role='admin' or exists(select 1 from public.user_products where user_id=p.id and product_id=p_product_id))) then raise exception 'Product access denied' using errcode='42501';end if;
end$$;
create function public.qa_generate_images(uuid,text,text,jsonb) returns void language plpgsql as $$begin
 if not exists(select 1 from public.qa_image_worker where id='local-native' and generation_available and heartbeat_at>now()-interval '45 seconds') then raise exception 'Native image worker is offline. Start the QA image worker first.'; end if;
end$$;
-- Publication validation is tested separately by the real QA fixture suite.
create function public.qa_inspiration_import_data(public.inspiration_results) returns jsonb language sql as $$select '{}'::jsonb$$;
