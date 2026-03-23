-- Create table for AI-generated ad suggestions
CREATE TABLE public.ad_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  hook TEXT NOT NULL,
  target_emotion TEXT NOT NULL,
  format TEXT NOT NULL,
  platform TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ad_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS policies using existing has_client_access function
CREATE POLICY "Users can view ad suggestions for accessible clients"
ON public.ad_suggestions
FOR SELECT
USING (public.has_client_access(auth.uid(), client_id));

CREATE POLICY "Users can insert ad suggestions for accessible clients"
ON public.ad_suggestions
FOR INSERT
WITH CHECK (public.has_client_access(auth.uid(), client_id));

CREATE POLICY "Users can delete ad suggestions for accessible clients"
ON public.ad_suggestions
FOR DELETE
USING (public.has_client_access(auth.uid(), client_id));