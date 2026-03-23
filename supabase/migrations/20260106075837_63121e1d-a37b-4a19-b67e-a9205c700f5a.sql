-- Add late_post_id column to text_posts for tracking synced posts
ALTER TABLE public.text_posts ADD COLUMN IF NOT EXISTS late_post_id TEXT;