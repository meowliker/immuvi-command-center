-- Add last_status_change_at to ads for status-change date filtering.
-- This file mirrors the standalone migration that previously lived outside
-- the Supabase migration chain.

ALTER TABLE public.ads
  ADD COLUMN IF NOT EXISTS last_status_change_at BIGINT;

UPDATE public.ads
   SET last_status_change_at = (EXTRACT(EPOCH FROM updated_at) * 1000)::BIGINT
 WHERE last_status_change_at IS NULL
   AND updated_at IS NOT NULL;

UPDATE public.ads
   SET last_status_change_at = (EXTRACT(EPOCH FROM created_at) * 1000)::BIGINT
 WHERE last_status_change_at IS NULL
   AND created_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ads_last_status_change_at
  ON public.ads (last_status_change_at)
  WHERE last_status_change_at IS NOT NULL;
