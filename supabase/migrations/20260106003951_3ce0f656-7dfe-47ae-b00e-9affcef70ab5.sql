-- Create text_posts table for storing generated text posts
CREATE TABLE public.text_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'scheduled', 'published')),
  scheduled_date TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  guideline_id UUID REFERENCES public.content_planner_guidelines(id) ON DELETE SET NULL,
  session_id TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.text_posts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own text posts"
  ON public.text_posts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own text posts"
  ON public.text_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own text posts"
  ON public.text_posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own text posts"
  ON public.text_posts FOR DELETE
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER update_text_posts_updated_at
  BEFORE UPDATE ON public.text_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.text_posts;