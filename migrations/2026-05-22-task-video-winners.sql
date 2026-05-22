-- task_video_winners: one row per (task, video file) that has been marked as winner.
-- Multiple winners per task are natural; a task with no rows has no winners marked yet.
CREATE TABLE IF NOT EXISTS public.task_video_winners (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id           text NOT NULL,                         -- references ads.id (AD-080 etc.)
  drive_file_id   text NOT NULL,                         -- Google Drive file id
  file_name       text NOT NULL,                         -- display name from Drive
  thumbnail_url   text,                                  -- Drive thumbnailLink, can be null
  web_view_url    text,                                  -- Drive webViewLink
  marked_winner_at timestamptz NOT NULL DEFAULT now(),
  marked_by       text,                                  -- user email/handle, nullable
  notes           text,                                  -- short strategist note ("shock-stain hook")
  UNIQUE (ad_id, drive_file_id)
);

CREATE INDEX IF NOT EXISTS idx_task_video_winners_ad
  ON public.task_video_winners(ad_id);

-- variation_briefs: one brief per winning video file. Once generated, reused
-- across all future seeds-from-this-variation. Avoids re-running the LLM pipeline.
CREATE TABLE IF NOT EXISTS public.variation_briefs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_file_id     text NOT NULL UNIQUE,
  ad_id             text NOT NULL,                       -- parent ad
  brief_markdown    text NOT NULL,                       -- the 7-section brief content
  clickup_doc_page_url text,                             -- where it lives in ClickUp
  generated_at      timestamptz NOT NULL DEFAULT now(),
  generated_by      text                                 -- worker_id that generated it
);

CREATE INDEX IF NOT EXISTS idx_variation_briefs_ad
  ON public.variation_briefs(ad_id);

-- Queue table for the variation_brief_worker
CREATE TABLE IF NOT EXISTS public.variation_brief_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_ad_id    text NOT NULL,
  drive_file_id   text NOT NULL,
  target_ad_id    text NOT NULL,
  status          text NOT NULL DEFAULT 'pending',     -- pending | classifying | done | failed
  attempts        int  NOT NULL DEFAULT 0,
  claimed_by      text,
  claimed_at      timestamptz,
  processed_at    timestamptz,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_variation_brief_queue_status
  ON public.variation_brief_queue(status, created_at);
