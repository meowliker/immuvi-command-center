-- ════════════════════════════════════════════════════════════════════════
-- Migration: User Management System
-- Date: 2026-05-08
--
-- Adds Supabase-Auth-backed user management:
--   profiles            — 1:1 with auth.users, holds role + active flag
--   user_products       — which products a member can see (admins bypass)
--   admin_audit_log     — admin action audit trail
--
-- Plus helper functions:
--   is_admin()          — true if calling user is admin
--   has_product(p)      — true if calling user has access to product p
--
-- And RLS on the NEW tables (producer_runs, strategist_*) — gated by
-- has_product(). Workers use service_role and bypass RLS — unchanged.
--
-- Legacy tables (ads, manual_actions, action_plan, inspiration_queue,
-- deleted_ads, etc.) DO NOT have RLS enabled in this migration. Their
-- policies are written but commented out — flip them on table-by-table
-- AFTER verifying each path under authed sessions. See:
--   docs/superpowers/plans/2026-05-08-user-management.md (Phase 5)
--
-- Idempotent: safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

-- ============================================================
-- 1. CORE TABLES
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  username text unique,
  full_name text,
  role text not null default 'member' check (role in ('admin','member')),
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  last_login_at timestamptz
);
create index if not exists idx_profiles_username on public.profiles(username);
create index if not exists idx_profiles_role on public.profiles(role);

create table if not exists public.user_products (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id) on delete set null,
  primary key (user_id, product_id)
);
create index if not exists idx_user_products_user on public.user_products(user_id);
create index if not exists idx_user_products_product on public.user_products(product_id);

create table if not exists public.admin_audit_log (
  id bigserial primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_user uuid references auth.users(id) on delete set null,
  target_product text,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_audit_actor on public.admin_audit_log(actor_id);
create index if not exists idx_admin_audit_action on public.admin_audit_log(action);
create index if not exists idx_admin_audit_target_user on public.admin_audit_log(target_user);

-- ============================================================
-- 2. HELPER FUNCTIONS
-- ============================================================

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role = 'admin' and is_active
       from public.profiles
      where id = auth.uid()),
    false);
$$;

create or replace function public.has_product(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (
           select 1
             from public.user_products up
             join public.profiles pr on pr.id = up.user_id
            where up.user_id = auth.uid()
              and up.product_id = p
              and pr.is_active = true);
$$;

grant execute on function public.is_admin()      to authenticated, anon;
grant execute on function public.has_product(text) to authenticated, anon;

-- ============================================================
-- 3. AUTO-PROVISION PROFILE ON SIGNUP
-- ============================================================

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, username, role, must_change_password)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role', 'member'),
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, true)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 4. RLS ON USER-MGMT TABLES
-- ============================================================

alter table public.profiles        enable row level security;
alter table public.user_products   enable row level security;
alter table public.admin_audit_log enable row level security;

-- profiles
drop policy if exists profiles_self_read     on public.profiles;
drop policy if exists profiles_self_update   on public.profiles;
drop policy if exists profiles_admin_insert  on public.profiles;
drop policy if exists profiles_admin_delete  on public.profiles;

create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy profiles_self_update on public.profiles
  for update using (id = auth.uid() or public.is_admin())
            with check (id = auth.uid() or public.is_admin());

create policy profiles_admin_insert on public.profiles
  for insert with check (public.is_admin());

create policy profiles_admin_delete on public.profiles
  for delete using (public.is_admin());

-- user_products
drop policy if exists user_products_self_read   on public.user_products;
drop policy if exists user_products_admin_write on public.user_products;

create policy user_products_self_read on public.user_products
  for select using (user_id = auth.uid() or public.is_admin());

create policy user_products_admin_write on public.user_products
  for all using (public.is_admin()) with check (public.is_admin());

-- admin_audit_log: admins read, service_role inserts (or admins insert via RLS)
drop policy if exists audit_admin_read   on public.admin_audit_log;
drop policy if exists audit_admin_insert on public.admin_audit_log;

create policy audit_admin_read on public.admin_audit_log
  for select using (public.is_admin());

create policy audit_admin_insert on public.admin_audit_log
  for insert with check (public.is_admin());

-- ============================================================
-- 5. RLS ON NEW PRODUCT-SCOPED TABLES (this-session tables only)
--    Workers use service_role and bypass RLS — unchanged.
-- ============================================================

-- producer_runs
alter table public.producer_runs enable row level security;
drop policy if exists producer_runs_authed on public.producer_runs;
create policy producer_runs_authed on public.producer_runs for all
  using (public.has_product(product_id))
  with check (public.has_product(product_id));

-- strategist_memory
alter table public.strategist_memory enable row level security;
drop policy if exists strategist_memory_authed on public.strategist_memory;
create policy strategist_memory_authed on public.strategist_memory for all
  using (public.has_product(product_id))
  with check (public.has_product(product_id));

-- strategist_runs
alter table public.strategist_runs enable row level security;
drop policy if exists strategist_runs_authed on public.strategist_runs;
create policy strategist_runs_authed on public.strategist_runs for all
  using (public.has_product(product_id))
  with check (public.has_product(product_id));

-- strategist_processed
alter table public.strategist_processed enable row level security;
drop policy if exists strategist_processed_authed on public.strategist_processed;
create policy strategist_processed_authed on public.strategist_processed for all
  using (public.has_product(product_id))
  with check (public.has_product(product_id));

-- ============================================================
-- 6. CONVENIENCE VIEW FOR ADMIN UI
-- ============================================================

create or replace view public.profiles_with_products as
  select
    p.id,
    p.email,
    p.username,
    p.full_name,
    p.role,
    p.is_active,
    p.must_change_password,
    p.created_at,
    p.created_by,
    p.last_login_at,
    coalesce(
      (select array_agg(product_id order by product_id)
         from public.user_products
        where user_id = p.id),
      ARRAY[]::text[]
    ) as product_ids
  from public.profiles p;

grant select on public.profiles_with_products to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- LEGACY TABLE RLS — INTENTIONALLY DEFERRED
-- These policies are READY but NOT applied. Run as a SEPARATE migration
-- after table-by-table verification under authed sessions.
--
-- For each of: ads, manual_actions, angles, personas, matrix_cells,
--              angle_personas, inspirations, inspiration_queue,
--              inspiration_results, deleted_ads, activity_events:
--
--   alter table public.<T> enable row level security;
--   create policy <T>_authed on public.<T> for all
--     using (public.has_product(product_id))
--     with check (public.has_product(product_id));
--
-- See docs/superpowers/plans/2026-05-08-user-management.md Phase 5
-- ════════════════════════════════════════════════════════════════════════
