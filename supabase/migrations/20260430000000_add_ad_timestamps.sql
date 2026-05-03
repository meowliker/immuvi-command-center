-- ─────────────────────────────────────────────────────────────────────────
-- 20260430000000_add_ad_timestamps.sql
--
-- Adds created_at + updated_at columns to the `ads` table.
--
-- Why:
--   Matrix v4 surfaces a Created date column + relative-time labels
--   ("2d ago"), an activity timeline, and a stale-cell filter that needs
--   to know when a creative was added vs last touched.
--
-- Source of truth:
--   * For ads imported from ClickUp: ClickUp `date_created` / `date_updated`
--     (epoch ms strings; the app parses them into bigint).
--   * For ads created locally: Date.now() at insert.
--
-- Storage choice:
--   bigint over timestamptz so we can write the raw ClickUp epoch ms
--   without lossy conversions and sort numerically. The app converts to
--   Date on display.
--
-- Backfill:
--   Existing rows get the row's INSERT time as a "best-guess" created_at
--   so the activity timeline doesn't show "Unknown" everywhere on day 1.
--   Updated_at is left null for legacy rows; the next ClickUp poll fills
--   it in via Pass 1's diff sync.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE ads
  ADD COLUMN IF NOT EXISTS created_at bigint,
  ADD COLUMN IF NOT EXISTS updated_at bigint;

-- Best-guess backfill so existing data has SOMETHING for the new column.
UPDATE ads
   SET created_at = EXTRACT(EPOCH FROM now()) * 1000
 WHERE created_at IS NULL;

-- Useful for the modal's "sort by recency" + "stale cell" filter.
CREATE INDEX IF NOT EXISTS ads_created_at_idx ON ads (created_at DESC);
CREATE INDEX IF NOT EXISTS ads_updated_at_idx ON ads (updated_at DESC);
