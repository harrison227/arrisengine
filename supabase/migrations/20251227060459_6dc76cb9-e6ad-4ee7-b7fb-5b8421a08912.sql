-- Add new columns to content_pieces for social media scheduling
ALTER TABLE public.content_pieces 
  ADD COLUMN IF NOT EXISTS caption TEXT,
  ADD COLUMN IF NOT EXISTS hashtags TEXT[],
  ADD COLUMN IF NOT EXISTS platforms TEXT[],
  ADD COLUMN IF NOT EXISTS scheduled_date TIMESTAMPTZ;