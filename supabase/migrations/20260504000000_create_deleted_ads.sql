-- Create deleted_ads before the RLS policy migration that references it.
-- The app uses ads.deleted_at as the authoritative soft-delete signal and
-- deleted_ads as the cross-tab / ClickUp re-import tombstone.

ALTER TABLE public.ads
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ads_deleted_at
  ON public.ads(product_id, deleted_at);

CREATE TABLE IF NOT EXISTS public.deleted_ads (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  clickup_task_id text,
  format_name text,
  reason text,
  deleted_by text,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deleted_ads_product
  ON public.deleted_ads(product_id);

CREATE INDEX IF NOT EXISTS idx_deleted_ads_clickup_task
  ON public.deleted_ads(clickup_task_id)
  WHERE clickup_task_id IS NOT NULL;
