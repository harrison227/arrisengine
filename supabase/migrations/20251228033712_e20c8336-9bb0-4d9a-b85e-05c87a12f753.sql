-- Allow public to view clients linked to active share links
CREATE POLICY "Public can view clients via active share link"
ON public.clients
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.calendar_share_links
    WHERE calendar_share_links.client_id = clients.id
    AND calendar_share_links.is_active = true
  )
);

-- Allow public to view content plans linked to active share links
CREATE POLICY "Public can view content plans via active share link"
ON public.content_plans
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.calendar_share_links
    WHERE calendar_share_links.client_id = content_plans.client_id
    AND calendar_share_links.is_active = true
  )
);

-- Allow public to view content pieces linked to active share links
CREATE POLICY "Public can view content pieces via active share link"
ON public.content_pieces
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.content_plans
    JOIN public.calendar_share_links ON calendar_share_links.client_id = content_plans.client_id
    WHERE content_plans.id = content_pieces.content_plan_id
    AND calendar_share_links.is_active = true
  )
);