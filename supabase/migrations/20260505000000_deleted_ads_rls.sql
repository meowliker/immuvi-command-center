-- ============================================================
-- deleted_ads RLS — open to anon (matches v1 policy on the rest
-- of the schema in 20260418122155_init.sql).
--
-- Background (2026-05-05):
-- The `deleted_ads` table was created outside the migration
-- history (likely via the Supabase dashboard) with RLS enabled
-- but no policy. Default-deny was silently rejecting every
-- client INSERT/UPSERT — visible in client logs as:
--   42501 "new row violates row-level security policy for
--   table \"deleted_ads\""
--
-- This was masked because the previous client code at
-- deleteAdEverywhere fired the upsert as `.then(function(){})`
-- without checking the error. Cross-client tombstones never
-- actually persisted in production for the entire lifetime
-- of the table.
--
-- Today's fix made the upsert error visible. The client now
-- treats the upsert as best-effort (logs warn, continues —
-- the soft-delete on `ads` is the authoritative signal). This
-- migration restores the intended behavior so the tombstone
-- ALSO actually lands, strengthening the ClickUp re-import
-- filter at parseClickUpTask consumers and any future cross-
-- client checks.
-- ============================================================

-- Make sure RLS is on (idempotent).
alter table public.deleted_ads enable row level security;

-- Drop any prior version of this policy so the migration is
-- idempotent if applied twice (or partially).
drop policy if exists deleted_ads_anon_all on public.deleted_ads;

-- Allow anon to do everything — matches the existing v1 policy
-- pattern for ads / matrix_cells / manual_actions / etc. When
-- auth is added project-wide, this should be tightened to an
-- auth.uid()-scoped check at the same time as those tables.
create policy deleted_ads_anon_all
  on public.deleted_ads
  for all
  to anon
  using (true)
  with check (true);
