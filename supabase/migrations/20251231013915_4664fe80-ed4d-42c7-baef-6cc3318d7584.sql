-- Create table for storing client reference images
CREATE TABLE public.client_reference_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  thumbnail_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.client_reference_images ENABLE ROW LEVEL SECURITY;

-- Users with client access can view reference images
CREATE POLICY "Users with client access can view reference images"
ON public.client_reference_images
FOR SELECT
USING (has_client_access(auth.uid(), client_id));

-- Users with client access can manage reference images
CREATE POLICY "Users with client access can manage reference images"
ON public.client_reference_images
FOR ALL
USING (has_client_access(auth.uid(), client_id));

-- Create index for faster lookups
CREATE INDEX idx_client_reference_images_client_id ON public.client_reference_images(client_id);
CREATE INDEX idx_client_reference_images_active ON public.client_reference_images(client_id, is_active) WHERE is_active = true;