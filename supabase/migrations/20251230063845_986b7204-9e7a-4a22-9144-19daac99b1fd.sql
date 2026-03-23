-- Create plan_feedback table to store client responses
CREATE TABLE public.plan_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  share_link_id UUID REFERENCES public.plan_share_links(id) ON DELETE CASCADE NOT NULL,
  content_plan_id UUID REFERENCES public.content_plans(id) ON DELETE CASCADE NOT NULL,
  idea_index INTEGER NOT NULL,
  idea_title TEXT,
  status TEXT NOT NULL CHECK (status IN ('approved', 'revision', 'rejected')),
  feedback_text TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  submitted_by_name TEXT
);

-- Add feedback_submitted_at to plan_share_links
ALTER TABLE public.plan_share_links 
ADD COLUMN feedback_submitted_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS
ALTER TABLE public.plan_feedback ENABLE ROW LEVEL SECURITY;

-- Allow public insert (clients submitting feedback without auth)
CREATE POLICY "Anyone can insert feedback" ON public.plan_feedback
  FOR INSERT WITH CHECK (true);

-- Authenticated users can view feedback for their plans
CREATE POLICY "Users can view feedback for their plans" ON public.plan_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.plan_share_links psl
      WHERE psl.id = plan_feedback.share_link_id
      AND psl.created_by = auth.uid()
    )
  );

-- Allow public update to plan_share_links for feedback_submitted_at
CREATE POLICY "Anyone can update feedback_submitted_at" ON public.plan_share_links
  FOR UPDATE USING (true) WITH CHECK (true);