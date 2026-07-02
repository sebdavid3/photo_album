-- ============================================================
-- Add video_url column to letters table for YouTube embeds
-- ============================================================

ALTER TABLE letters ADD COLUMN IF NOT EXISTS video_url TEXT;
