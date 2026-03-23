-- Create shortform_ideas table for storing AI-generated short-form content ideas
CREATE TABLE public.shortform_ideas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  hook TEXT NOT NULL,
  format_type TEXT NOT NULL,
  platform TEXT NOT NULL,
  trending_angle TEXT,
  shot_list TEXT[],
  duration INTEGER,
  audio_suggestion TEXT,
  status TEXT DEFAULT 'idea' CHECK (status IN ('idea', 'queued', 'filmed', 'posted')),
  filming_day_id UUID REFERENCES public.filming_days(id) ON DELETE SET NULL,
  ai_generated BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shortform_ideas ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - users can only access ideas for clients they own
CREATE POLICY "Users can view shortform ideas for their clients"
ON public.shortform_ideas
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = shortform_ideas.client_id 
    AND clients.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create shortform ideas for their clients"
ON public.shortform_ideas
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = shortform_ideas.client_id 
    AND clients.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update shortform ideas for their clients"
ON public.shortform_ideas
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = shortform_ideas.client_id 
    AND clients.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete shortform ideas for their clients"
ON public.shortform_ideas
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = shortform_ideas.client_id 
    AND clients.user_id = auth.uid()
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_shortform_ideas_updated_at
BEFORE UPDATE ON public.shortform_ideas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();