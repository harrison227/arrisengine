-- Drop the existing constraint
ALTER TABLE public.text_posts DROP CONSTRAINT text_posts_status_check;

-- Add the updated constraint with all valid statuses including rejected and changes_requested
ALTER TABLE public.text_posts ADD CONSTRAINT text_posts_status_check 
CHECK (status = ANY (ARRAY['draft'::text, 'approved'::text, 'scheduled'::text, 'published'::text, 'pending_review'::text, 'rejected'::text, 'changes_requested'::text]));