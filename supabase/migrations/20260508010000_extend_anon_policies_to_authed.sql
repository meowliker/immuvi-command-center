-- ════════════════════════════════════════════════════════════════════════
-- Migration: Extend anon-scoped RLS policies to authenticated users
-- Date: 2026-05-08
--
-- Discovered after applying user-management migration: every legacy
-- product-scoped table (products, ads, manual_actions, angles, personas,
-- matrix_cells, angle_personas, inspirations, inspiration_queue,
-- inspiration_results, deleted_ads, activity_events, worker_registry)
-- has RLS enabled with policies scoped to the `anon` role only.
--
-- Once a user signs in, their role flips from `anon` to `authenticated`,
-- and these policies no longer apply → all queries return empty rows
-- silently.
--
-- This migration replaces each `<T>_anon_all` policy with a `<T>_open_all`
-- policy that has no role restriction (applies to all roles, anon and
-- authenticated alike). Net effect: existing pre-login behavior is
-- preserved, AND authed users get the same broad access.
--
-- This is a TEMPORARY restoration of pre-auth functionality.
-- Phase 5 of the user-management plan replaces these `using (true)`
-- policies with `using (has_product(product_id))` per table after each
-- read/write path is verified under authed sessions.
-- See: docs/superpowers/plans/2026-05-08-user-management.md
--
-- Workers use `service_role` and bypass RLS — unaffected.
-- Idempotent: safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

do $$
declare
  t text;
  legacy_tables text[] := array[
    'products', 'ads', 'manual_actions', 'angles', 'personas',
    'matrix_cells', 'angle_personas', 'inspirations',
    'inspiration_queue', 'inspiration_results', 'deleted_ads',
    'activity_events', 'worker_registry'
  ];
begin
  foreach t in array legacy_tables loop
    execute format('drop policy if exists %I on public.%I',
                   t || '_anon_all', t);
    execute format('drop policy if exists %I on public.%I',
                   t || '_open_all', t);
    execute format($p$
      create policy %I on public.%I
        for all
        using (true)
        with check (true)
    $p$, t || '_open_all', t);
  end loop;
end $$;

-- Quick sanity report.
select c.relname as table_name, p.polname,
       array(select rolname from pg_roles r where r.oid = any(p.polroles)) as roles,
       p.polcmd
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
 where c.relnamespace = 'public'::regnamespace
   and c.relname in ('products','ads','manual_actions','angles','personas',
                     'matrix_cells','angle_personas','inspirations',
                     'inspiration_queue','inspiration_results','deleted_ads',
                     'activity_events','worker_registry')
 order by c.relname, p.polname;
