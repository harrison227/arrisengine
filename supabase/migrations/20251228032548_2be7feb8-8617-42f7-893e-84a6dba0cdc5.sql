-- Create calendar_share_links table for storing shareable calendar links
CREATE TABLE public.calendar_share_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_id TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Add index for fast share_id lookup (used by public page)
CREATE INDEX idx_calendar_share_links_share_id ON public.calendar_share_links(share_id);

-- Add index for client_id lookup (used in client detail tab)
CREATE INDEX idx_calendar_share_links_client_id ON public.calendar_share_links(client_id);

-- Enable Row Level Security
ALTER TABLE public.calendar_share_links ENABLE ROW LEVEL SECURITY;

-- Policy: Admins/owners can manage all share links
CREATE POLICY "Admins can manage calendar share links"
ON public.calendar_share_links
FOR ALL
USING (is_admin_or_owner(auth.uid()));

-- Policy: Users with client access can view share links for that client
CREATE POLICY "Users with client access can view share links"
ON public.calendar_share_links
FOR SELECT
USING (has_client_access(auth.uid(), client_id));

-- Policy: Users with client access can create share links for their clients
CREATE POLICY "Users with client access can create share links"
ON public.calendar_share_links
FOR INSERT
WITH CHECK (has_client_access(auth.uid(), client_id));

-- Policy: Public access to active share links (for the /view/:shareId page)
-- This allows anonymous users to read the share link metadata
CREATE POLICY "Anyone can read active share links by share_id"
ON public.calendar_share_links
FOR SELECT
USING (is_active = true);