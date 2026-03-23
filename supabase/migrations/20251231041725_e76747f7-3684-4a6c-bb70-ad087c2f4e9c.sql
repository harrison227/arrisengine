-- Create image_batch_revisions table to store version history
CREATE TABLE public.image_batch_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_item_id UUID NOT NULL REFERENCES public.image_batch_items(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  model_used TEXT,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_batch_revisions_item ON public.image_batch_revisions(batch_item_id);

-- Enable RLS
ALTER TABLE public.image_batch_revisions ENABLE ROW LEVEL SECURITY;

-- RLS policies matching parent image_batch_items table
CREATE POLICY "Users can view revisions from their sessions"
ON public.image_batch_revisions
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.image_batch_items ibi
  JOIN public.ai_sessions s ON ibi.session_id = s.id
  WHERE ibi.id = image_batch_revisions.batch_item_id
  AND s.user_id = auth.uid()
));

CREATE POLICY "Users can create revisions in their sessions"
ON public.image_batch_revisions
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.image_batch_items ibi
  JOIN public.ai_sessions s ON ibi.session_id = s.id
  WHERE ibi.id = image_batch_revisions.batch_item_id
  AND s.user_id = auth.uid()
));