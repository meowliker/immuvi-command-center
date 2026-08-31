-- Cached Drive folder listings for creative task assets.
-- Mirrors migrations/2026-05-22b-task-drive-cache.sql inside the normal
-- Supabase migration chain for fresh QA projects.

CREATE TABLE IF NOT EXISTS public.task_drive_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id text NOT NULL,
  drive_file_id text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  thumbnail_url text,
  web_view_url text,
  modified_time timestamptz,
  size_bytes bigint,
  cached_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ad_id, drive_file_id)
);

CREATE INDEX IF NOT EXISTS idx_task_drive_cache_ad
  ON public.task_drive_cache(ad_id);

CREATE INDEX IF NOT EXISTS idx_task_drive_cache_age
  ON public.task_drive_cache(cached_at DESC);
