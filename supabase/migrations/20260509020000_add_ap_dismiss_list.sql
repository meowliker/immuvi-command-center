-- Per-user "Clear from my AP" dismiss list (2026-05-09)
--
-- Soft-hides cards from the user's own AP view without affecting other users.
-- Stores AD ids (works for both real MAs and auto-adopted virtual cards).
-- Reversible via "Show hidden" toggle.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ap_dismissed_ad_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.ap_dismissed_ad_ids IS
  'Array of AD ids the user has cleared from their AP view. Per-user soft hide; does not delete the underlying MA or AD.';
