-- Drop the existing check constraint
ALTER TABLE public.text_posts DROP CONSTRAINT IF EXISTS text_posts_status_check;

-- Add the new check constraint including pending_review
ALTER TABLE public.text_posts ADD CONSTRAINT text_posts_status_check 
CHECK (status IN ('draft', 'approved', 'scheduled', 'published', 'pending_review'));