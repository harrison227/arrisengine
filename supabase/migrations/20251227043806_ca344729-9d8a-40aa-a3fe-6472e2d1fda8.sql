-- Add brand identity columns to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS brand_primary_color text,
ADD COLUMN IF NOT EXISTS brand_secondary_color text,
ADD COLUMN IF NOT EXISTS brand_accent_color text,
ADD COLUMN IF NOT EXISTS brand_background_color text,
ADD COLUMN IF NOT EXISTS brand_text_color text,
ADD COLUMN IF NOT EXISTS brand_fonts text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS brand_style_notes text,
ADD COLUMN IF NOT EXISTS brand_logo_url text;