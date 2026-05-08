-- Testing-stage checkpoint tracking (2026-05-09)
--
-- Surfaces a Day-7 review prompt for Testing tasks, allows ONE 7-day snooze
-- ("needs more testing"), then forces a Day-14 final-call decision. Both
-- columns are reset on every Testing entry/exit by _stampAdStatusChange so
-- the cycle is always fresh.
--
-- Storage cost: ~16 bytes / row. Realtime budget: these change rarely
-- (once on snooze, once on Testing exit) — safe to include in the upsert
-- hash.

ALTER TABLE public.ads
  ADD COLUMN IF NOT EXISTS testing_deferred_at BIGINT NULL,
  ADD COLUMN IF NOT EXISTS testing_defer_count INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.ads.testing_deferred_at IS
  'Epoch ms when buyer clicked "Needs more testing" at Day-7 checkpoint. NULL = no snooze used in current Testing cycle.';
COMMENT ON COLUMN public.ads.testing_defer_count IS
  'Number of snoozes used in current Testing cycle (capped at 1). Reset to 0 on every Testing entry/exit.';
