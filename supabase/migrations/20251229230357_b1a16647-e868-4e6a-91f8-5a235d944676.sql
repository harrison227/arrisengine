-- Create analytics share links table for public sharing of analytics dashboards
CREATE TABLE public.analytics_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  share_id TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  date_range_start DATE,
  date_range_end DATE,
  platforms TEXT[]
);

-- Enable RLS
ALTER TABLE public.analytics_share_links ENABLE ROW LEVEL SECURITY;

-- Policy: Users with client access can manage analytics share links
CREATE POLICY "Users with client access can manage analytics share links"
ON public.analytics_share_links
FOR ALL
USING (has_client_access(auth.uid(), client_id));

-- Policy: Users with client access can view analytics share links
CREATE POLICY "Users with client access can view analytics share links"
ON public.analytics_share_links
FOR SELECT
USING (has_client_access(auth.uid(), client_id));

-- Policy: Public can view active share links by share_id
CREATE POLICY "Public can view active analytics share links"
ON public.analytics_share_links
FOR SELECT
USING (is_active = true);

-- Create index for faster lookups
CREATE INDEX idx_analytics_share_links_share_id ON public.analytics_share_links(share_id);
CREATE INDEX idx_analytics_share_links_client_id ON public.analytics_share_links(client_id);