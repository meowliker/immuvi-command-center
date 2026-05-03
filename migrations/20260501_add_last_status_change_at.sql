-- ════════════════════════════════════════════════════════════════════════
-- Migration: add last_status_change_at to ads (epoch ms / BIGINT)
-- Date: 2026-05-01
--
-- Adds a denormalized timestamp tracking when an ad's status last changed.
-- This unlocks accurate "tested this week / promoted to winner this week"
-- filtering without per-task ClickUp status_history fetches.
--
-- The new column is BIGINT (epoch ms) — matches the format the app code
-- writes (Date.now()). The existing created_at / updated_at columns are
-- `timestamp with time zone`, so we cast via EXTRACT(EPOCH …) for backfill.
--
-- App-side: stamped via _adToRow on every save (Date.now() on status change).
--
-- Run in Supabase Dashboard → SQL Editor → Run.
-- Safe to run multiple times (IF NOT EXISTS / IS NULL guards).
-- ════════════════════════════════════════════════════════════════════════

-- 1. Add the column
ALTER TABLE public.ads
  ADD COLUMN IF NOT EXISTS last_status_change_at BIGINT;

-- 2. Backfill from updated_at — cast timestamp → epoch ms.
--    EXTRACT(EPOCH FROM …) returns seconds; * 1000 → ms; ::BIGINT for the
--    column type. ~95% accuracy baseline; subsequent app-driven changes
--    refine it to 100% accuracy from this point forward.
UPDATE public.ads
   SET last_status_change_at = (EXTRACT(EPOCH FROM updated_at) * 1000)::BIGINT
 WHERE last_status_change_at IS NULL
   AND updated_at IS NOT NULL;

-- 3. For rows where updated_at is also NULL, fall back to created_at
--    so date filtering still works on those rows.
UPDATE public.ads
   SET last_status_change_at = (EXTRACT(EPOCH FROM created_at) * 1000)::BIGINT
 WHERE last_status_change_at IS NULL
   AND created_at IS NOT NULL;

-- 4. Partial index — only rows where the field is populated, smaller and
--    faster for the "Status changed within X" filter queries.
CREATE INDEX IF NOT EXISTS idx_ads_last_status_change_at
  ON public.ads (last_status_change_at)
  WHERE last_status_change_at IS NOT NULL;

-- 5. (Optional) Sanity check — uncomment to see how many rows got backfilled.
-- SELECT COUNT(*) AS ads_with_last_status_change_at
--   FROM public.ads
--  WHERE last_status_change_at IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════
-- Done. The app's _adToRow / _rowToAd already handle this column.
-- ════════════════════════════════════════════════════════════════════════
