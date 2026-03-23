-- Create filming_days table (one active filming day per client)
CREATE TABLE public.filming_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  location TEXT,
  call_time TIME,
  wrap_time TIME,
  notes TEXT,
  equipment_needed TEXT[] DEFAULT '{}',
  team_members UUID[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'in_progress', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on filming_days
ALTER TABLE public.filming_days ENABLE ROW LEVEL SECURITY;

-- RLS policies for filming_days
CREATE POLICY "Users with client access can view filming days"
  ON public.filming_days FOR SELECT
  USING (has_client_access(auth.uid(), client_id));

CREATE POLICY "Users with client access can manage filming days"
  ON public.filming_days FOR ALL
  USING (has_client_access(auth.uid(), client_id));

-- Trigger for updated_at
CREATE TRIGGER update_filming_days_updated_at
  BEFORE UPDATE ON public.filming_days
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enhance content_pieces with production fields
ALTER TABLE public.content_pieces 
  ADD COLUMN IF NOT EXISTS filming_day_id UUID REFERENCES public.filming_days(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS script TEXT,
  ADD COLUMN IF NOT EXISTS shot_notes TEXT,
  ADD COLUMN IF NOT EXISTS cta TEXT,
  ADD COLUMN IF NOT EXISTS target_duration INTEGER,
  ADD COLUMN IF NOT EXISTS talent_notes TEXT,
  ADD COLUMN IF NOT EXISTS b_roll_needed TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS edit_notes TEXT,
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Create creative_concepts table (enhanced ad angles)
CREATE TABLE public.creative_concepts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  hook TEXT NOT NULL,
  description TEXT NOT NULL,
  target_emotion TEXT NOT NULL,
  format TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'in_development', 'active', 'paused', 'retired')),
  cta_options TEXT[] DEFAULT '{}',
  target_audiences TEXT[] DEFAULT '{}',
  performance_notes TEXT,
  ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on creative_concepts
ALTER TABLE public.creative_concepts ENABLE ROW LEVEL SECURITY;

-- RLS policies for creative_concepts
CREATE POLICY "Users with client access can view creative concepts"
  ON public.creative_concepts FOR SELECT
  USING (has_client_access(auth.uid(), client_id));

CREATE POLICY "Users with client access can manage creative concepts"
  ON public.creative_concepts FOR ALL
  USING (has_client_access(auth.uid(), client_id));

-- Trigger for updated_at
CREATE TRIGGER update_creative_concepts_updated_at
  BEFORE UPDATE ON public.creative_concepts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create creative_variations table
CREATE TABLE public.creative_variations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creative_concept_id UUID NOT NULL REFERENCES public.creative_concepts(id) ON DELETE CASCADE,
  headline TEXT NOT NULL,
  body_copy TEXT,
  cta TEXT,
  platform_notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'testing', 'winner', 'loser')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on creative_variations
ALTER TABLE public.creative_variations ENABLE ROW LEVEL SECURITY;

-- RLS policies for creative_variations
CREATE POLICY "Users can view variations of accessible concepts"
  ON public.creative_variations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.creative_concepts 
    WHERE creative_concepts.id = creative_variations.creative_concept_id 
    AND has_client_access(auth.uid(), creative_concepts.client_id)
  ));

CREATE POLICY "Users can manage variations of accessible concepts"
  ON public.creative_variations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.creative_concepts 
    WHERE creative_concepts.id = creative_variations.creative_concept_id 
    AND has_client_access(auth.uid(), creative_concepts.client_id)
  ));

-- Enhance knowledge_entries with importance and source
ALTER TABLE public.knowledge_entries 
  ADD COLUMN IF NOT EXISTS importance TEXT DEFAULT 'medium' CHECK (importance IN ('critical', 'high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ai_generated', 'website_scraped')),
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE;

-- Create knowledge_summary table for AI analysis
CREATE TABLE public.knowledge_summary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE UNIQUE,
  positioning_summary TEXT,
  key_differentiators TEXT[] DEFAULT '{}',
  content_opportunities TEXT[] DEFAULT '{}',
  compliance_flags TEXT[] DEFAULT '{}',
  ideal_customer_profile TEXT,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on knowledge_summary
ALTER TABLE public.knowledge_summary ENABLE ROW LEVEL SECURITY;

-- RLS policies for knowledge_summary
CREATE POLICY "Users with client access can view knowledge summary"
  ON public.knowledge_summary FOR SELECT
  USING (has_client_access(auth.uid(), client_id));

CREATE POLICY "Users with client access can manage knowledge summary"
  ON public.knowledge_summary FOR ALL
  USING (has_client_access(auth.uid(), client_id));

-- Link content pieces to creative concepts
CREATE TABLE public.content_creative_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_piece_id UUID NOT NULL REFERENCES public.content_pieces(id) ON DELETE CASCADE,
  creative_concept_id UUID NOT NULL REFERENCES public.creative_concepts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(content_piece_id, creative_concept_id)
);

-- Enable RLS on content_creative_links
ALTER TABLE public.content_creative_links ENABLE ROW LEVEL SECURITY;

-- RLS policies for content_creative_links
CREATE POLICY "Users can view links for accessible content"
  ON public.content_creative_links FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.content_pieces cp
    JOIN public.content_plans pl ON cp.content_plan_id = pl.id
    WHERE cp.id = content_creative_links.content_piece_id 
    AND has_client_access(auth.uid(), pl.client_id)
  ));

CREATE POLICY "Users can manage links for accessible content"
  ON public.content_creative_links FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.content_pieces cp
    JOIN public.content_plans pl ON cp.content_plan_id = pl.id
    WHERE cp.id = content_creative_links.content_piece_id 
    AND has_client_access(auth.uid(), pl.client_id)
  ));