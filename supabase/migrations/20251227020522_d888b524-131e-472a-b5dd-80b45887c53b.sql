-- Add content planner specific AI settings columns
ALTER TABLE public.ai_voice_settings 
ADD COLUMN IF NOT EXISTS content_planner_master_prompt TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS preferred_formats TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS preferred_platforms TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS preferred_hooks_style TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS content_themes TEXT[] DEFAULT '{}';