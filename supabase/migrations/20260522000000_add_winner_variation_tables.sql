-- Winner artifact + variation brief tables.
-- Mirrors migrations/2026-05-22-task-video-winners.sql inside the normal
-- Supabase migration chain for fresh QA projects.

CREATE TABLE IF NOT EXISTS public.task_video_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id text NOT NULL,
  drive_file_id text NOT NULL,
  file_name text NOT NULL,
  thumbnail_url text,
  web_view_url text,
  marked_winner_at timestamptz NOT NULL DEFAULT now(),
  marked_by text,
  notes text,
  UNIQUE (ad_id, drive_file_id)
);

CREATE INDEX IF NOT EXISTS idx_task_video_winners_ad
  ON public.task_video_winners(ad_id);

CREATE TABLE IF NOT EXISTS public.variation_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_file_id text NOT NULL UNIQUE,
  ad_id text NOT NULL,
  brief_markdown text NOT NULL,
  clickup_doc_page_url text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by text
);

CREATE INDEX IF NOT EXISTS idx_variation_briefs_ad
  ON public.variation_briefs(ad_id);

CREATE TABLE IF NOT EXISTS public.variation_brief_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_ad_id text NOT NULL,
  drive_file_id text NOT NULL,
  target_ad_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  claimed_by text,
  claimed_at timestamptz,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_variation_brief_queue_status
  ON public.variation_brief_queue(status, created_at);
