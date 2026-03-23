-- Create plan_share_links table for client approval portal
CREATE TABLE public.plan_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id text NOT NULL UNIQUE,
  content_plan_id uuid NOT NULL REFERENCES public.content_plans(id) ON DELETE CASCADE,
  client_name text,
  expires_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

-- Enable RLS
ALTER TABLE public.plan_share_links ENABLE ROW LEVEL SECURITY;

-- Allow public read access for active links
CREATE POLICY "Public can view active plan share links"
ON public.plan_share_links FOR SELECT
USING (is_active = true);

-- Authenticated users can manage their links
CREATE POLICY "Users can manage their plan share links"
ON public.plan_share_links FOR ALL
USING (created_by = auth.uid());

-- Add policy for public access to content plans via plan share links
CREATE POLICY "Public can view content plans via plan share link"
ON public.content_plans FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.plan_share_links
    WHERE plan_share_links.content_plan_id = content_plans.id
    AND plan_share_links.is_active = true
  )
);

-- Add policy for public access to clients via plan share links (for branding)
CREATE POLICY "Public can view clients via plan share link"
ON public.clients FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.plan_share_links psl
    JOIN public.content_plans cp ON cp.id = psl.content_plan_id
    WHERE cp.client_id = clients.id
    AND psl.is_active = true
  )
);