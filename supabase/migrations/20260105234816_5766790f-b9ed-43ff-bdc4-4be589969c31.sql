-- Create content_planner_guidelines table
CREATE TABLE public.content_planner_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'twitter', 'threads')),
  name TEXT NOT NULL,
  text_guidelines TEXT,
  pdf_url TEXT,
  pdf_filename TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.content_planner_guidelines ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own guidelines"
  ON public.content_planner_guidelines FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own guidelines"
  ON public.content_planner_guidelines FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own guidelines"
  ON public.content_planner_guidelines FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own guidelines"
  ON public.content_planner_guidelines FOR DELETE
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER update_content_planner_guidelines_updated_at
  BEFORE UPDATE ON public.content_planner_guidelines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for guideline PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('planner-guidelines', 'planner-guidelines', false);

-- Storage RLS policies
CREATE POLICY "Users can upload own guideline files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'planner-guidelines' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own guideline files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'planner-guidelines' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own guideline files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'planner-guidelines' AND auth.uid()::text = (storage.foldername(name))[1]);