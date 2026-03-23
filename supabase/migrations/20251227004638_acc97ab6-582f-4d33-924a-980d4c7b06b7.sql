-- AI Sessions table to persist interactive sessions
CREATE TABLE public.ai_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  session_type TEXT NOT NULL CHECK (session_type IN ('filming_plan', 'image_batch')),
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'paused')),
  title TEXT,
  session_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Image batch items for tracking 30-image generation
CREATE TABLE public.image_batch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.ai_sessions(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  concept TEXT NOT NULL,
  template_type TEXT NOT NULL,
  platform TEXT DEFAULT 'instagram',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'approved', 'skipped', 'regenerating')),
  generated_image_url TEXT,
  asset_id UUID REFERENCES public.assets(id),
  feedback TEXT,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_batch_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_sessions
CREATE POLICY "Users can view their own sessions"
ON public.ai_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions"
ON public.ai_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
ON public.ai_sessions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
ON public.ai_sessions FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for image_batch_items (through session ownership)
CREATE POLICY "Users can view batch items from their sessions"
ON public.image_batch_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.ai_sessions 
  WHERE ai_sessions.id = image_batch_items.session_id 
  AND ai_sessions.user_id = auth.uid()
));

CREATE POLICY "Users can create batch items in their sessions"
ON public.image_batch_items FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.ai_sessions 
  WHERE ai_sessions.id = image_batch_items.session_id 
  AND ai_sessions.user_id = auth.uid()
));

CREATE POLICY "Users can update batch items in their sessions"
ON public.image_batch_items FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.ai_sessions 
  WHERE ai_sessions.id = image_batch_items.session_id 
  AND ai_sessions.user_id = auth.uid()
));

CREATE POLICY "Users can delete batch items in their sessions"
ON public.image_batch_items FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.ai_sessions 
  WHERE ai_sessions.id = image_batch_items.session_id 
  AND ai_sessions.user_id = auth.uid()
));

-- Indexes for performance
CREATE INDEX idx_ai_sessions_client_id ON public.ai_sessions(client_id);
CREATE INDEX idx_ai_sessions_user_id ON public.ai_sessions(user_id);
CREATE INDEX idx_ai_sessions_status ON public.ai_sessions(status);
CREATE INDEX idx_image_batch_items_session_id ON public.image_batch_items(session_id);
CREATE INDEX idx_image_batch_items_status ON public.image_batch_items(status);

-- Triggers for updated_at
CREATE TRIGGER update_ai_sessions_updated_at
BEFORE UPDATE ON public.ai_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_image_batch_items_updated_at
BEFORE UPDATE ON public.image_batch_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();