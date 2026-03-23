-- Add policy for public access to filming days via active share links
CREATE POLICY "Public can view filming days via active share links"
ON public.filming_days
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.plan_share_links psl
    JOIN public.content_plans cp ON psl.content_plan_id = cp.id
    WHERE cp.client_id = filming_days.client_id
    AND psl.is_active = true
  )
);