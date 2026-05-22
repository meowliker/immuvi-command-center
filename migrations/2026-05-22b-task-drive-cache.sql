-- task_drive_cache: pre-fetched Drive folder listings, populated by a
-- background sync worker for NEW ads (going forward). Legacy ads are NOT
-- backfilled — the picker falls back to a live Drive API call for cache
-- misses, so old tasks still work but get slightly slower first-open.
--
-- One row per (ad_id, drive_file_id). Re-syncing an ad upserts on this key.
CREATE TABLE IF NOT EXISTS public.task_drive_cache (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id           text NOT NULL,
  drive_file_id   text NOT NULL,
  file_name       text NOT NULL,
  mime_type       text,
  thumbnail_url   text,
  web_view_url    text,
  modified_time   timestamptz,
  size_bytes      bigint,
  cached_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ad_id, drive_file_id)
);

CREATE INDEX IF NOT EXISTS idx_task_drive_cache_ad
  ON public.task_drive_cache(ad_id);

CREATE INDEX IF NOT EXISTS idx_task_drive_cache_age
  ON public.task_drive_cache(cached_at DESC);
