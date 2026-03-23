-- Agency settings table (one per user/workspace)
CREATE TABLE public.agency_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  agency_name TEXT DEFAULT '',
  logo_url TEXT,
  primary_color TEXT DEFAULT '#8B5CF6',
  secondary_color TEXT DEFAULT '#1E1E2E',
  timezone TEXT DEFAULT 'UTC',
  working_hours_start TIME DEFAULT '09:00',
  working_hours_end TIME DEFAULT '17:00',
  default_email_signature TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- AI voice/tone settings
CREATE TABLE public.ai_voice_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  tone TEXT DEFAULT 'professional' CHECK (tone IN ('professional', 'casual', 'bold', 'friendly', 'authoritative')),
  formality_level INTEGER DEFAULT 3 CHECK (formality_level >= 1 AND formality_level <= 5),
  creativity_level INTEGER DEFAULT 3 CHECK (creativity_level >= 1 AND creativity_level <= 5),
  custom_instructions TEXT DEFAULT '',
  avoid_phrases TEXT[] DEFAULT '{}',
  preferred_phrases TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- AI prompt templates (reusable)
CREATE TABLE public.ai_prompt_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('content_brief', 'ad_angles', 'strategy', 'email', 'social_post', 'custom')),
  prompt_text TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  industry_filter TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Email templates
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('welcome', 'proposal', 'invoice', 'report', 'reminder', 'custom')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agency_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_voice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Agency settings policies
CREATE POLICY "Users can view own agency settings"
  ON public.agency_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own agency settings"
  ON public.agency_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own agency settings"
  ON public.agency_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- AI voice settings policies
CREATE POLICY "Users can view own ai voice settings"
  ON public.ai_voice_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own ai voice settings"
  ON public.ai_voice_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ai voice settings"
  ON public.ai_voice_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- AI prompt templates policies
CREATE POLICY "Users can view own ai prompt templates"
  ON public.ai_prompt_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own ai prompt templates"
  ON public.ai_prompt_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ai prompt templates"
  ON public.ai_prompt_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ai prompt templates"
  ON public.ai_prompt_templates FOR DELETE
  USING (auth.uid() = user_id);

-- Email templates policies
CREATE POLICY "Users can view own email templates"
  ON public.email_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own email templates"
  ON public.email_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email templates"
  ON public.email_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own email templates"
  ON public.email_templates FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at triggers
CREATE TRIGGER update_agency_settings_updated_at
  BEFORE UPDATE ON public.agency_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_voice_settings_updated_at
  BEFORE UPDATE ON public.ai_voice_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_prompt_templates_updated_at
  BEFORE UPDATE ON public.ai_prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();