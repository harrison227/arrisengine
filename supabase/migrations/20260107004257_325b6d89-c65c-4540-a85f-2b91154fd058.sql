-- Add client feedback columns to text_posts table
ALTER TABLE public.text_posts 
ADD COLUMN IF NOT EXISTS client_feedback TEXT,
ADD COLUMN IF NOT EXISTS client_feedback_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS client_feedback_by TEXT;